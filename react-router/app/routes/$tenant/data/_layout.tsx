import { Outlet } from "react-router";

export const handle = { breadcrumb: "Data" };

export default function DataLayout() {
  return <Outlet />;
}
