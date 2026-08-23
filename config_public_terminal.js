// The root OS image location, change to local filepath if serving locally
export const diskImageUrl = "wss://disks.webvm.io/debian_buster_large_permis_fixed_01-06-2026.ext2";
// The root filesystem backend type use "cloud" for serving remotely or "bytes" for serving locally
export const diskImageType = "cloud";
// Print an introduction message about the technology
export const printIntro = true;
// Is a graphical display needed
export const needsDisplay = false;
// Executable full path (Required)
export const cmd = "/bin/bash";
// Arguments, as an array (Required)
export const args = ["--login"];
// Optional extra parameters
export const opts = {
	// Environment variables
	env: [
		"HOME=/home/user",
		"TERM=xterm-256color",
		"USER=Hacker",
		"LOGNAME=Hacker",
		"SHELL=/bin/bash",
		"EDITOR=vim",
		"LANG=en_US.UTF-8",
		"LC_ALL=C",
		"PROMPT_COMMAND=export PS1='\\[\\033[1;34m\\][[ \\[\\033[1;33m\\]K \\[\\033[1;37m\\]: \\[\\033[1;32m\\]\\w \\[\\033[1;34m\\]]] \\[\\033[1;37m\\]: \\[\\033[1;35m\\]\\$ \\[\\033[1;36m\\]'; trap 'printf \"\\033[0m\"' DEBUG"
	],
	// Current working directory
	cwd: "/home/user",
	// User id
	uid: 1000,
	// Group id
	gid: 1000
};
