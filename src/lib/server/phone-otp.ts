import { createServerFn } from "@tanstack/react-start";

export const completePhoneAuth = createServerFn({ method: "POST" })
  .validator((d: { idToken: string; name?: string }) => d)
  .handler(async ({ data }) => {
    const { completeVerifiedPhoneLogin } = await import("./phone-otp.server");
    return completeVerifiedPhoneLogin(data.idToken, data.name);
  });
