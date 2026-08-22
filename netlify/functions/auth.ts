import type { Config } from "@netlify/functions";

let serverAdminPin = process.env.ADMIN_PIN || "1234";

export default async (req: Request) => {
  const method = req.method;

  try {
    if (method === "POST") {
      const body = await req.json();
      const { action, pin, currentPin, newPin } = body;

      // ACTION 1: Verify PIN
      if (action === "verify") {
        const isValid = pin && String(pin).trim() === serverAdminPin.trim();
        return Response.json({
          success: isValid,
          message: isValid ? "Autenticato con successo" : "PIN non corretto",
        });
      }

      // ACTION 2: Change PIN (Requires correct currentPin)
      if (action === "change") {
        if (!currentPin || String(currentPin).trim() !== serverAdminPin.trim()) {
          return Response.json(
            {
              success: false,
              message: "Il PIN attuale inserito non è corretto. Modifica rifiutata.",
            },
            { status: 401 }
          );
        }

        if (!newPin || String(newPin).trim().length < 4) {
          return Response.json(
            {
              success: false,
              message: "Il nuovo PIN deve contenere almeno 4 cifre.",
            },
            { status: 400 }
          );
        }

        serverAdminPin = String(newPin).trim();
        return Response.json({
          success: true,
          message: "PIN aggiornato con successo.",
        });
      }

      return Response.json({ error: "Invalid action" }, { status: 400 });
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  } catch (error: any) {
    return Response.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/auth",
};
