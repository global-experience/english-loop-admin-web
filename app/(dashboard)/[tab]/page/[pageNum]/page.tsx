import { notFound, redirect } from "next/navigation";
import { DEFAULT_TAB, isTab } from "@/lib/tabs";

export const dynamic = "force-dynamic";

export default async function TabPageRedirect({
  params,
}: {
  params: Promise<{ tab: string; pageNum: string }>;
}) {
  const { tab, pageNum } = await params;
  if (!isTab(tab)) notFound();
  const num = parseInt(pageNum, 10);
  const validPage = Number.isFinite(num) && num > 0 ? num : 1;
  const targetTab = tab === DEFAULT_TAB ? "" : `/${tab}`;
  redirect(`${targetTab || "/"}?page=${validPage}`);
}
