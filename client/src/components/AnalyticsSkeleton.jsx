// โครงหน้า Analytics ระหว่างรอข้อมูล / รอโหลดโค้ดกราฟ
export default function AnalyticsSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-[74px] rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="skeleton h-[340px] rounded-2xl" />
        <div className="skeleton h-[340px] rounded-2xl" />
      </div>
    </div>
  )
}
