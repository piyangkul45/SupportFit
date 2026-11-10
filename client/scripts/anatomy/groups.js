// ชื่อโครงสร้างใน anatomy.glb (BodyParts3D + Z-Anatomy) -> กลุ่มกล้ามเนื้อของแอป (ตรงกับ MUSCLES ใน src/utils/exerciseAnatomy.js)
// ส่วนที่ไม่ตรงกลุ่มใด = 'base' (สีเงินธรรมดา) ; ใช้ทั้งตอนเลือกมัดที่เรืองแสงและตอนกำหนดน้ำหนัก skinning ตามช่วงร่างกาย
const RULES = [
  ['chest', /pectoralis major/],
  ['back', /latissimus|trapezius|rhomboid|teres major|teres minor|infraspinatus|iliocostalis|longissimus|spinalis|multifidus|erector|quadratus lumborum|serratus posterior/],
  ['shoulders', /deltoid|supraspinatus/],
  ['biceps', /biceps brachii|brachialis|coracobrachialis/],
  ['triceps', /triceps brachii|anconeus/],
  ['forearms', /brachioradialis|carpi|palmaris|pronator|supinator|flexor digitorum superficialis|flexor digitorum profundus|extensor digitorum(?! (brevis|longus))|extensor indicis|flexor pollicis longus|abductor pollicis longus|extensor pollicis|extensor digiti minimi(?! of)/],
  ['abs', /rectus abdominis|external oblique|internal oblique|transversus abdominis|pyramidalis/],
  ['glutes', /gluteus/],
  ['quads', /rectus femoris|vastus/],
  ['hamstrings', /biceps femoris|semitendinosus|semimembranosus/],
  ['calves', /gastrocnemius|soleus|plantaris/],
]
// มัดลึกที่ไม่เห็นบนร่างจริง แต่ mesh ของ Z-Anatomy วางทับหน้าท้อง (บังซิกแพ็ก) -> ไม่แสดง
export const HIDDEN = /internal oblique|transversus abdominis/
export function muscleGroup(name) {
  const n = name.toLowerCase()
  for (const [group, re] of RULES) if (re.test(n)) return group
  return 'base'
}

// ช่วงร่างกายของแต่ละชิ้น (ใช้จำกัดกระดูกที่มีผลต่อ vertex ตอน skinning ไม่ให้แขนติดลำตัว ฯลฯ)
// L/R จากชื่อ left/right ; ไม่มีระบุ = กลางลำตัว
export function bodyRegion(name) {
  const n = name.toLowerCase()
  const side = /\bleft\b/.test(n) ? 'L' : /\bright\b/.test(n) ? 'R' : ''
  const has = (re) => re.test(n)
  if (has(/hand|finger|thumb|pollicis|digiti minimi of (left|right) hand|palm|carpal|metacarp|phalan.*(hand|finger|thumb)|lumbrical of (left|right) hand|interosse.* hand|hamate|capitate|trapezium|trapezoid|scaphoid|lunate|triquetr|pisiform/)) return side + 'hand'
  if (has(/foot|toe|hallucis|tars|calcane|talus|navicular|cuboid|cuneiform|metatars|phalan.*(toe|foot)|digiti minimi of (left|right) foot|plantar|quadratus plantae/)) return side + 'foot'
  if (has(/forearm|radius|ulna|carpi|palmaris|pronator|supinator|brachioradialis|flexor digitorum superficialis|flexor digitorum profundus|extensor digitorum(?! (brevis|longus))|extensor indicis|flexor pollicis longus|abductor pollicis longus|extensor pollicis|anconeus/)) return side + 'forearm'
  if (has(/humerus|biceps brachii|brachialis|coracobrachialis|triceps brachii/)) return side + 'upperarm'
  if (has(/deltoid|supraspinatus|infraspinatus|teres|subscapularis|scapula|clavicle|pectoralis|latissimus|serratus anterior|rhomboid|levator scapulae|trapezius/)) return side + 'shoulder'
  if (has(/tibia|fibula|gastrocnemius|soleus|plantaris|tibialis|peroneus|fibularis|popliteus|extensor digitorum longus|extensor hallucis longus|flexor digitorum longus|flexor hallucis longus|patell/)) return side + 'shin'
  if (has(/femur|rectus femoris|vastus|biceps femoris|semitendinosus|semimembranosus|sartorius|gracilis|adductor|pectineus|tensor fasciae latae/)) return side + 'thigh'
  if (has(/gluteus|piriformis|obturator|gemellus|quadratus femoris|ilium|ischium|pubis|hip bone|iliacus|psoas|sacrum|coccy|levator ani|pelvi/)) return 'pelvis'
  if (has(/skull|cranium|mandible|maxilla|frontal bone|parietal|occipital|temporal|sphenoid|ethmoid|zygomatic|nasal|lacrimal|palatine|vomer|hyoid|masseter|temporalis|pterygoid|orbicularis|buccinator|mentalis|nasalis|zygomaticus|risorius|depressor|levator labii|frontalis|occipitofrontalis|procerus|corrugator|auricular|tongue|glossus|palat|pharyn|laryn|arytenoid|thyroid|cricoid|epiglott|rectus capitis|obliquus capitis|oblique$|rectus$|superior oblique|inferior oblique|lateral rectus|medial rectus|superior rectus|inferior rectus|eyelid|stapedius|tensor tympani|incus|malleus|stapes|tooth|teeth|gingiva/)) return 'head'
  if (has(/cervical|atlas|axis|sternocleidomastoid|scalene|longus colli|longus capitis|splenius|platysma|digastric|mylohyoid|geniohyoid|stylohyoid|omohyoid|sternohyoid|sternothyroid|thyrohyoid|semispinalis capitis|levator scapulae/)) return 'neck'
  if (has(/lumbar|rectus abdominis|oblique|transversus abdominis|pyramidalis|quadratus lumborum|cremaster/)) return 'abdomen'
  if (has(/thoracic|rib|stern|xiphoid|manubrium|intercostal|diaphragm|serratus posterior|subclavius|transversus thoracis|levatores costarum|iliocostalis|longissimus|spinalis|semispinalis thoracis|multifidus|rotatores|interspinal|intertransvers/)) return 'chest'
  return null // ไม่รู้จากชื่อ -> ให้ฉากจัดตามตำแหน่ง (กระดูกที่ใกล้ที่สุด)
}
