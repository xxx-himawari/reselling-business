import "./globals.css";
export const metadata = {
  title: "物販検証｜登録基盤",
  description: "商品・仕入見積・数量別プランの手動登録",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
