import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RootPageRedirect({
  params,
}: {
  params: Promise<{ pageNum: string }>;
}) {
  const { pageNum } = await params;
  const num = parseInt(pageNum, 10);
  const validPage = Number.isFinite(num) && num > 0 ? num : 1;
  redirect(`/?page=${validPage}`);
}
