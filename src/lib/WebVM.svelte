<script>
	import { onMount, tick } from 'svelte';
	import { get } from 'svelte/store';
	import '$lib/global.css';
	import '@xterm/xterm/css/xterm.css'
	import '@fortawesome/fontawesome-free/css/all.min.css'
	import { networkInterface, startLogin } from '$lib/network.js'
	import { cpuActivity, diskActivity, cpuPercentage, diskLatency } from '$lib/activities.js'
	import { introMessage, errorMessage, unexpectedErrorMessage } from '$lib/messages.js'
	import { displayConfig, handleToolImpl } from '$lib/anthropic.js'
	import { tryPlausible } from '$lib/plausible.js'

	export let configObj = null;
	export let processCallback = null;
	export let cacheId = null;
	export let cpuActivityEvents = [];
	export let diskLatencies = [];
	export let activityEventsInterval = 0;

	var term = null;
	var cx = null;
	var fitAddon = null;
	var cxReadFunc = null;
	var blockCache = null;
	var processCount = 0;
	var curVT = 0;
	var sideBarPinned = false;
	function writeData(buf, vt)
	{
		if(vt != 1)
			return;
		term.write(new Uint8Array(buf));
	}
	function readData(str)
	{
		if(cxReadFunc == null)
			return;
		for(var i=0;i<str.length;i++)
			cxReadFunc(str.charCodeAt(i));
	}
	function printMessage(msg)
	{
		for(var i=0;i<msg.length;i++)
			term.write(msg[i] + "\n");
	}
	function expireEvents(list, curTime, limitTime)
	{
		while(list.length > 1)
		{
			if(list[1].t < limitTime)
			{
				list.shift();
			}
			else
			{
				break;
			}
		}
	}
	function cleanupEvents()
	{
		var curTime = Date.now();
		var limitTime = curTime - 10000;
		expireEvents(cpuActivityEvents, curTime, limitTime);
		computeCpuActivity(curTime, limitTime);
		if(cpuActivityEvents.length == 0)
		{
			clearInterval(activityEventsInterval);
			activityEventsInterval = 0;
		}
	}
	function computeCpuActivity(curTime, limitTime)
	{
		var totalActiveTime = 0;
		var lastActiveTime = limitTime;
		var lastWasActive = false;
		for(var i=0;i<cpuActivityEvents.length;i++)
		{
			var e = cpuActivityEvents[i];
			// NOTE: The first event could be before the limit,
			//       we need at least one event to correctly mark
			//       active time when there is long time under load
			var eTime = e.t;
			if(eTime < limitTime)
				eTime = limitTime;
			if(e.state == "ready")
			{
				// Inactive state, add the time from lastActiveTime
				totalActiveTime += (eTime - lastActiveTime);
				lastWasActive = false;
			}
			else
			{
				// Active state
				lastActiveTime = eTime;
				lastWasActive = true;
			}
		}
		// Add the last interval if needed
		if(lastWasActive)
		{
			totalActiveTime += (curTime - lastActiveTime);
		}
		cpuPercentage.set(Math.ceil((totalActiveTime / 10000) * 100));
	}
	function hddCallback(state)
	{
		diskActivity.set(state != "ready");
	}
	function latencyCallback(latency)
	{
		diskLatencies.push(latency);
		if(diskLatencies.length > 30)
			diskLatencies.shift();
		// Average the latency over at most 30 blocks
		var total = 0;
		for(var i=0;i<diskLatencies.length;i++)
			total += diskLatencies[i];
		var avg = total / diskLatencies.length;
		diskLatency.set(Math.ceil(avg));
	}
	function cpuCallback(state)
	{
		cpuActivity.set(state != "ready");
		var curTime = Date.now();
		var limitTime = curTime - 10000;
		expireEvents(cpuActivityEvents, curTime, limitTime);
		cpuActivityEvents.push({t: curTime, state: state});
		computeCpuActivity(curTime, limitTime);
		// Start an interval timer to cleanup old samples when no further activity is received
		if(activityEventsInterval != 0)
			clearInterval(activityEventsInterval);
		activityEventsInterval = setInterval(cleanupEvents, 2000);
	}
	function computeXTermFontSize()
	{
		return parseInt(getComputedStyle(document.body).fontSize);
	}
	function setScreenSize(display)
	{
		var internalMult = 1.0;
		var displayWidth = display.offsetWidth;
		var displayHeight = display.offsetHeight;
		var minWidth = 1024;
		var minHeight = 768;
		if(displayWidth < minWidth)
			internalMult = minWidth / displayWidth;
		if(displayHeight < minHeight)
			internalMult = Math.max(internalMult, minHeight / displayHeight);
		var internalWidth = Math.floor(displayWidth * internalMult);
		var internalHeight = Math.floor(displayHeight * internalMult);
		cx.setKmsCanvas(display, internalWidth, internalHeight);
		// Compute the size to be used for AI screenshots
		var screenshotMult = 1.0;
		var maxWidth = 1024;
		var maxHeight = 768;
		if(internalWidth > maxWidth)
			screenshotMult = maxWidth / internalWidth;
		if(internalHeight > maxHeight)
			screenshotMult = Math.min(screenshotMult, maxHeight / internalHeight);
		var screenshotWidth = Math.floor(internalWidth * screenshotMult);
		var screenshotHeight = Math.floor(internalHeight * screenshotMult);
		// Track the state of the mouse as requested by the AI, to avoid losing the position due to user movement
		displayConfig.set({width: screenshotWidth, height: screenshotHeight, mouseMult: internalMult * screenshotMult});
	}
	var curInnerWidth = 0;
	var curInnerHeight = 0;
	function handleResize()
	{
		// Avoid spurious resize events caused by the soft keyboard
		if(curInnerWidth == window.innerWidth && curInnerHeight == window.innerHeight)
			return;
		curInnerWidth = window.innerWidth;
		curInnerHeight = window.innerHeight;
		triggerResize();
	}
	function triggerResize()
	{
		term.options.fontSize = computeXTermFontSize();
		fitAddon.fit();
		const display = document.getElementById("display");
		if(display)
			setScreenSize(display);
	}
	async function initTerminal()
	{
		const { Terminal } = await import('@xterm/xterm');
		const { FitAddon } = await import('@xterm/addon-fit');
		const { WebLinksAddon } = await import('@xterm/addon-web-links');
		term = new Terminal({cursorBlink:true, convertEol:true, fontFamily:"monospace", fontWeight: 400, fontWeightBold: 700, fontSize: computeXTermFontSize()});
		fitAddon = new FitAddon();
		term.loadAddon(fitAddon);
		var linkAddon = new WebLinksAddon();
		term.loadAddon(linkAddon);
		const consoleDiv = document.getElementById("console");
		term.open(consoleDiv);
		term.scrollToTop();
		fitAddon.fit();
		window.addEventListener("resize", handleResize);
		term.focus();
		term.onData(readData);
		// Avoid undesired default DnD handling
		function preventDefaults (e) {
			e.preventDefault()
			e.stopPropagation()
		}
		consoleDiv.addEventListener("dragover", preventDefaults, false);
		consoleDiv.addEventListener("dragenter", preventDefaults, false);
		consoleDiv.addEventListener("dragleave", preventDefaults, false);
		consoleDiv.addEventListener("drop", preventDefaults, false);
		curInnerWidth = window.innerWidth;
		curInnerHeight = window.innerHeight;
		if(configObj.printIntro)
			printMessage(introMessage);
		try
		{
			await initCheerpX();
		}
		catch(e)
		{
			printMessage(unexpectedErrorMessage);
			printMessage([e.toString()]);
			return;
		}
	}
	function handleActivateConsole(vt)
	{
		if(curVT == vt)
			return;
		curVT = vt;
		if(vt != 7)
			return;
		// Raise the display to the foreground
		const display = document.getElementById("display");
		display.parentElement.style.zIndex = 5;
		tryPlausible("Display activated");
	}
	function handleProcessCreated()
	{
		processCount++;
		if(processCallback)
			processCallback(processCount);
	}
	async function initCheerpX()
	{
		const CheerpX = await import('@leaningtech/cheerpx');
		var blockDevice = null;
		switch(configObj.diskImageType)
		{
			case "cloud":
				try
				{
					blockDevice = await CheerpX.CloudDevice.create(configObj.diskImageUrl);
				}
				catch(e)
				{
					// Report the failure and try again with plain HTTP
					var wssProtocol = "wss:";
					if(configObj.diskImageUrl.startsWith(wssProtocol))
					{
						// WebSocket protocol failed, try agin using plain HTTP
						tryPlausible("WS Disk failure");
						blockDevice = await CheerpX.CloudDevice.create("https:" + configObj.diskImageUrl.substr(wssProtocol.length));
					}
					else
					{
						// No other recovery option
						throw e;
					}
				}
				break;
			case "bytes":
				blockDevice = await CheerpX.HttpBytesDevice.create(configObj.diskImageUrl);
				break;
			case "github":
				blockDevice = await CheerpX.GitHubDevice.create(configObj.diskImageUrl);
				break;
			default:
				throw new Error("Unrecognized device type");
		}
		blockCache = await CheerpX.IDBDevice.create(cacheId);
		var overlayDevice = await CheerpX.OverlayDevice.create(blockDevice, blockCache);
		var webDevice = await CheerpX.WebDevice.create("");
		var dataDevice = await CheerpX.DataDevice.create();
		var mountPoints = [
			// The root filesystem, as an Ext2 image
			{type:"ext2", dev:overlayDevice, path:"/"},
			// Access to files on the Web server, relative to the current page
			{type:"dir", dev:webDevice, path:"/web"},
			// Access to read-only data coming from JavaScript
			{type:"dir", dev:dataDevice, path:"/data"},
			// Automatically created device files
			{type:"devs", path:"/dev"},
			// Pseudo-terminals
			{type:"devpts", path:"/dev/pts"},
			// The Linux 'proc' filesystem which provides information about running processes
			{type:"proc", path:"/proc"},
			// The Linux 'sysfs' filesystem which is used to enumerate emulated devices
			{type:"sys", path:"/sys"}
		];
		try
		{
			cx = await CheerpX.Linux.create({mounts: mountPoints, networkInterface: networkInterface});
			// Setup /home/Hacker as home directory, remove default user, populate examples and documents with Hello Hacker ! sample files and about.txt
			await cx.run("/bin/sh", ["-c", "rm -rf /home/user 2>/dev/null || true; userdel -r user 2>/dev/null || true; sed -i '/^user:/d' /etc/passwd /etc/group /etc/shadow /etc/gshadow 2>/dev/null || true; sed -i 's/mesg n.*/# mesg n/g' /etc/profile /root/.profile /home/Hacker/.profile 2>/dev/null || true; mkdir -p /home/Hacker/examples/c /home/Hacker/examples/lua /home/Hacker/examples/nodejs /home/Hacker/examples/python3 /home/Hacker/examples/ruby /home/Hacker/documents 2>/dev/null || true; printf '#include <stdio.h>\\n\\nint main() {\\n    printf(\"Hello Hacker !\\\\n\");\\n    return 0;\\n}\\n' > /home/Hacker/examples/c/k.c; printf 'print(\"Hello Hacker !\")\\n' > /home/Hacker/examples/lua/k.lua; printf 'console.log(\"Hello Hacker !\");\\n' > /home/Hacker/examples/nodejs/k.js; printf 'print(\"Hello Hacker !\")\\n' > /home/Hacker/examples/python3/k.py; printf 'puts \"Hello Hacker !\"\\n' > /home/Hacker/examples/ruby/k.rb; cp -f /web/documents/* /home/Hacker/documents/ 2>/dev/null || true; printf '===============================================================================\\n                         ABOUT THE DEVELOPER & PROJECT\\n===============================================================================\\n\\nDeveloper:              Niranjan Kumar K\\nFamous As:              Father of Kni OS & K Programming Language\\nOrganization:           Founder and Backbone of KNI-Organization\\nQualifications:         Mastering Computer Science & Advanced Software Engineering\\nProject:                BrowserVM - WebAssembly Linux Virtual Terminal\\n\\nPowered by:             Leaning Technologies (CheerpX Engine)\\n\\n-------------------------------------------------------------------------------\\nSYSTEM CREDENTIALS & TERMINAL INFO:\\n-------------------------------------------------------------------------------\\nDefault Username:       Hacker\\nUser Password:          1234\\nRoot Password:          1234\\n\\nTerminal Prompt:        [[ K : path ]] $\\n===============================================================================\\n' > /home/Hacker/documents/about.txt; grep -q '^Hacker:' /etc/passwd || echo 'Hacker:x:1000:1000:Hacker:/home/Hacker:/bin/bash' >> /etc/passwd; grep -q '^Hacker:' /etc/group || echo 'Hacker:x:1000:' >> /etc/group; (echo 'Hacker:1234' | chpasswd || true); (echo 'root:1234' | chpasswd || true); chown -R Hacker:Hacker /home/Hacker 2>/dev/null || true; chmod -R 755 /home/Hacker 2>/dev/null || true; sed -i '/PROMPT_COMMAND/d; /DEBUG/d; /set_my_prompt/d' /etc/bash.bashrc /etc/profile /home/Hacker/.bashrc 2>/dev/null || true; echo \"export LS_COLORS='ow=01;34:tw=01;34:st=01;34:di=01;34'\" >> /etc/bash.bashrc; echo \"export LS_COLORS='ow=01;34:tw=01;34:st=01;34:di=01;34'\" >> /home/Hacker/.bashrc; echo \"alias ls='ls --color=auto -I index.list'\" >> /etc/bash.bashrc; echo \"alias ls='ls --color=auto -I index.list'\" >> /home/Hacker/.bashrc; echo 'set_my_prompt() { export PS1=\"\\[\\033[1;34m\\][[ \\[\\033[1;33m\\]K \\[\\033[1;37m\\]: \\[\\033[1;32m\\]\\w \\[\\033[1;34m\\]]] \\[\\033[1;37m\\]: \\[\\033[1;35m\\]\\$ \\[\\033[1;36m\\]\"; trap \"printf \\\"\\\\033[1;37m\\\"\" DEBUG; }' >> /etc/bash.bashrc; echo 'PROMPT_COMMAND=set_my_prompt' >> /etc/bash.bashrc; echo 'set_my_prompt() { export PS1=\"\\[\\033[1;34m\\][[ \\[\\033[1;33m\\]K \\[\\033[1;37m\\]: \\[\\033[1;32m\\]\\w \\[\\033[1;34m\\]]] \\[\\033[1;37m\\]: \\[\\033[1;35m\\]\\$ \\[\\033[1;36m\\]\"; trap \"printf \\\"\\\\033[1;37m\\\"\" DEBUG; }' >> /home/Hacker/.bashrc; echo 'PROMPT_COMMAND=set_my_prompt' >> /home/Hacker/.bashrc"], { uid: 0, gid: 0 });
		}
		catch(e)
		{
			printMessage(errorMessage);
			printMessage([e.toString()]);
			return;
		}
		cx.registerCallback("cpuActivity", cpuCallback);
		cx.registerCallback("diskActivity", hddCallback);
		cx.registerCallback("diskLatency", latencyCallback);
		cx.registerCallback("processCreated", handleProcessCreated);
		term.scrollToBottom();
		cxReadFunc = cx.setCustomConsole(writeData, term.cols, term.rows);
		const display = document.getElementById("display");
		if(display)
		{
			setScreenSize(display);
			cx.setActivateConsole(handleActivateConsole);
		}
		// Run the command in a loop, in case the user exits
		while (true)
		{
			await cx.run(configObj.cmd, configObj.args, configObj.opts);
		}
	}
	onMount(initTerminal);
	async function handleConnect()
	{
		cx.networkLogin();
		try
		{
			const loginUrl = await startLogin();
			window.open(loginUrl, "_blank");
		}
		catch(e)
		{
			console.warn(e);
		}
	}
	async function handleReset()
	{
		// Be robust before initialization
		if(blockCache == null)
			return;
		await blockCache.reset();
		location.reload();
	}
	async function handleTool(tool)
	{
		return await handleToolImpl(tool, term);
	}
	async function handleSidebarPinChange(event)
	{
		sideBarPinned = event.detail;
		// Make sure the pinning state of reflected in the layout
		await tick();
		// Adjust the layout based on the new sidebar state
		triggerResize();
	}
</script>

<main class="relative w-full h-full bg-black">
	{#if configObj.needsDisplay}
		<div class="absolute inset-0">
			<canvas class="w-full h-full cursor-none" id="display"></canvas>
		</div>
	{/if}
	<div class="absolute inset-0 p-1 scrollbar" id="console">
	</div>
</main>
