import { redirect } from "next/navigation";

/** /exhbts/<id> is the editor; the public page lives on the portfolio. */
export default async function ExhbtIndex({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/exhbts/${(await params).id}/edit`);
}
