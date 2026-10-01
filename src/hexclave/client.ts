import { HexclaveClientApp } from "@hexclave/next";

export const hexclaveClientApp = new HexclaveClientApp({
  tokenStore: "nextjs-cookie",
  urls: {
    default: {
      type: "handler-component",
    },
    handler: "/handler",
    signIn: "/mitglieder/login",
    signUp: "/mitglieder/signup",
    accountSettings: "/mitglieder/einstellungen",
    afterSignIn: "/mitglieder",
    afterSignUp: "/mitglieder",
    afterSignOut: "/",
    home: "/",
  },
});
