// The root filesystem location
export const diskImageUrl = IMAGE_URL;
// The root filesystem backend type
export const diskImageType = "github";
// Print an introduction message about the technology
export const printIntro = true;
// Is a graphical display needed
export const needsDisplay = false;
// Executable full path (Required)
export const cmd = CMD; // Default: "/bin/bash";
// Arguments, as an array (Required)
export const args = ARGS; // Default: ["--login"];
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
