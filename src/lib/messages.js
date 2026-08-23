const color = "\x1b[1;35m";
const boldCyan = "\x1b[1;36m";
const boldYellow = "\x1b[1;33m";
const boldGreen = "\x1b[1;32m";
const boldWhite = "\x1b[1;37m";
const normal = "\x1b[0m";

export const introMessage = [
  "+-----------------------------------------------------------------------------+",
  "|                            " + boldYellow + "Welcome to BrowserVM" + normal + "                             |",
  "+-----------------------------------------------------------------------------+",
  "|                                                                             |",
  "| " + boldWhite + "Developer:" + normal + "       " + boldCyan + "Niranjan Kumar K" + normal + "                                           |",
  "| " + boldWhite + "Powered by:" + normal + "      Leaning Technologies                                       |",
  "|                                                                             |",
  "+-----------------------------------------------------------------------------+",
  "",
  "   " + boldGreen + "Terminal initialized successfully." + normal,
  "",
];

export const errorMessage = [
  color + "CheerpX could not start" + normal,
  "",
  "Check the DevTools console for more information",
  "",
  "CheerpX is expected to work with recent desktop versions of Chrome, Edge, Firefox and Safari",
  "",
  "Give it a try from a desktop version / another browser!",
  "",
  "CheerpX internal error message is:",
  "",
];

export const unexpectedErrorMessage = [
  color + "BrowserVM encountered an unexpected error" + normal,
  "",
  "Check the DevTools console for further information",
  "",
  "Please consider reporting a bug!",
  "",
  "CheerpX internal error message is:",
  "",
];
