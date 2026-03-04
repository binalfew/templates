import { Outlet } from "react-router";

export const handle = { breadcrumb: "Security" };

export default function SecurityLayout() {
  return <Outlet />;
}
