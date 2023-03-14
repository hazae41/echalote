import Link from "next/link";

export default function Page() {
  return <>
    <div>
      <Link href="/http">http</Link>
    </div>
    <div>
      <Link href="/socket">socket</Link>
    </div>
  </>
}