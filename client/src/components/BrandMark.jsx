// โลโก้ SupportFit: ดัมเบลที่มือจับตรงกลางเป็นคลื่นเสียง (voice-to-data + fitness)
export default function BrandMark({ className = 'h-10 w-10' }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl border border-lime-400/20 bg-slate-900/80 ${className}`}
    >
      <svg
        viewBox="0 0 48 28"
        className="h-[68%] w-[68%] drop-shadow-[0_0_6px_rgba(163,230,53,0.85)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="sf-logo-grad" x1="0" y1="0" x2="48" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#bef264" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>

        {/* หัวดัมเบล — รูปทรงหลักที่ใหญ่/สูงที่สุดในไอคอน */}
        <rect x="2" y="2" width="6" height="24" rx="3" fill="url(#sf-logo-grad)" />
        <rect x="40" y="2" width="6" height="24" rx="3" fill="url(#sf-logo-grad)" />
        <rect x="9" y="6" width="3" height="16" rx="1.5" fill="url(#sf-logo-grad)" opacity="0.85" />
        <rect x="36" y="6" width="3" height="16" rx="1.5" fill="url(#sf-logo-grad)" opacity="0.85" />

        {/* ก้านจับ */}
        <rect x="13" y="12" width="22" height="4" rx="2" fill="url(#sf-logo-grad)" opacity="0.35" />

        {/* คลื่นเสียงฝังอยู่บนก้านจับ — เล็กกว่าหัวดัมเบลชัดเจน */}
        <rect x="16" y="11" width="2.4" height="6" rx="1.2" fill="#ecfccb" />
        <rect x="20.5" y="9" width="2.4" height="10" rx="1.2" fill="#ecfccb" />
        <rect x="25" y="7" width="2.4" height="14" rx="1.2" fill="#ecfccb" />
        <rect x="29.5" y="9" width="2.4" height="10" rx="1.2" fill="#ecfccb" />
        <rect x="34" y="11" width="2.4" height="6" rx="1.2" fill="#ecfccb" />
      </svg>
    </div>
  )
}
