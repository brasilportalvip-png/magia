import firebaseConfig from "../firebase-applet-config.json";

export default function handler(_req: any, res: any) {
  return res.status(200).json({
    status: "ok",
    project: "Magia das Crenças",
    database: firebaseConfig.firestoreDatabaseId || "(default)",
    gemini: {
      route: "/api/consult",
      primaryModel: process.env.GEMINI_PRIMARY_MODEL || "gemini-2.5-flash",
    },
    version: "2.0.0",
    timestamp: new Date().toISOString(),
  });
}
