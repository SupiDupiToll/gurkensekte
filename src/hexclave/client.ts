import { HexclaveClientApp } from "@hexclave/next";

export const hexclaveClientApp = new HexclaveClientApp({
  tokenStore: "nextjs-cookie",
  urls: {
    default: {
      type: "hosted",
    },
    afterSignIn: "/mitglieder",
    afterSignUp: "/mitglieder",
    afterSignOut: "/",
    home: "/",
  },
});
