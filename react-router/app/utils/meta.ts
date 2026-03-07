const APP_NAME = "App";

export function buildMeta(title: string, description?: string) {
  return [
    { title: `${title} | ${APP_NAME}` },
    ...(description ? [{ name: "description", content: description }] : []),
  ];
}
