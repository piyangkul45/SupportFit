// ข้อความที่ server ส่งกลับให้ผู้ใช้ (error/message ของ API และอีเมล OTP) ทั้งภาษาอังกฤษและไทย
// เลือกภาษาจาก header Accept-Language ที่ client ส่งมาตามภาษาที่ผู้ใช้เลือกในแอป (ค่าเริ่มต้น: อังกฤษ)

const MESSAGES = {
  en: {
    validation: {
      invalidEmail: 'Invalid email format',
      passwordTooShort: 'Password must be at least {min} characters',
      emailAndPasswordRequired: 'Please enter your email and password',
      emailAndCodeRequired: 'Please enter a valid email and 6-digit code',
    },
    otp: {
      sent: 'A verification code has been sent to {email}',
      waitBeforeResend: 'Please wait {seconds} seconds before requesting a new code',
      invalid: 'Incorrect code. Please try again.',
      expired: 'This code has expired. Please request a new one.',
      notFound: 'No code found for this email, or it has expired. Please request a new one.',
      tooManyAttempts: 'Too many incorrect attempts. Please request a new code.',
    },
    mail: {
      notConfigured: 'Sender email is not configured. Set RESEND_API_KEY in server/.env',
      unavailable: 'The email service is not available right now. Please try again later.',
      sendFailed: 'Could not send the email. Check RESEND_API_KEY or try again.',
      genericSendFailed: 'Could not send the code',
    },
    auth: {
      emailTaken: 'An account with this email already exists. Please log in.',
      signupFailed: 'Sign up failed',
      noSignup: 'No sign-up found for this email. Please sign up first.',
      alreadyVerified: 'This account is already verified. Please log in.',
      loginFailed: 'Login failed',
      wrongCredentials: 'Incorrect email or password',
      unverified: 'Your email is not verified yet. Enter the OTP code we sent to your email.',
      forgotPasswordSent:
        "If this email belongs to a verified account, we've sent a 6-digit code. Please check your inbox (and Spam folder).",
      passwordResetDone: 'Password updated and you have been logged out on all devices. Please log in with your new password.',
      passwordResetFailed: 'Could not set the new password',
      noToken: 'Access denied. Please log in.',
      sessionExpired: 'Your session has expired. Please log in again.',
      sessionRevoked: 'Your session was revoked. Please log in again.',
      sessionCheckFailed: 'Could not verify your session',
      userNotFound: 'Account not found. Please log in again.',
    },
    parser: {
      textRequired: 'Please provide the text to parse',
      notUnderstood: "Couldn't understand that command",
    },
    meal: {
      aiUnavailable: 'AI meal analysis is not configured. Set GEMINI_API_KEY in server/.env',
      notFood: "Couldn't find any food or drinks in that text",
      analyzeFailed: 'AI could not analyze this meal right now. Please try again.',
      timeout: 'The AI took too long to respond. Please try again in a moment.',
      busy: 'The AI service is busy right now. Please try again in a moment.',
      modelUnavailable: 'The configured AI model is unavailable. Check GEMINI_MODEL in server/.env',
    },
    data: {
      profileLoadFailed: 'Could not load the user profile',
      profileSaveFailed: 'Could not save your profile',
      invalidProfile: 'Please check your details: {field} is missing or out of range',
      profileDbNotReady:
        'Database not ready for profiles (onboarding columns missing on users). Run server/sql/schema.sql in the Supabase SQL Editor, or set DATABASE_URL in server/.env and restart the server',
      forbiddenRead: "You don't have access to this data",
      forbiddenWrite: "You can't save data for another user",
      ownershipCheckFailed: 'Permission check failed',
      workoutLoadFailed: 'Could not load workout logs',
      workoutHistoryFailed: 'Could not check previous records',
      workoutSaveFailed: 'Could not save the workout log',
      foodLoadFailed: 'Could not load food logs',
      foodSaveFailed: 'Could not save the food log',
      nameRequired: 'Please enter a name',
      invalidNumber: '{field} must be a number of 0 or more',
      logNotFound: 'This entry was not found or has already been deleted',
      deleteFailed: 'Could not delete the entry',
      dbNotReady:
        'Database not ready (users.email column or otp_codes table missing). Set DATABASE_URL in server/.env and restart the server, or run npm run migrate',
    },
    programs: {
      loadFailed: 'Could not load workout programs',
      saveFailed: 'Could not save the program',
      deleteFailed: 'Could not delete the program',
      activateFailed: 'Could not set the active program',
      notFound: 'Program not found',
      presetReadOnly: 'Preset programs cannot be changed. Create a custom program instead.',
      titleRequired: 'Please enter a program title',
      titleTooLong: 'Program title must be at most {max} characters',
      daysRequired: 'Please add at least one day',
      tooManyDays: 'A program can have at most {max} days',
      tooManyExercises: 'Day {day} can have at most {max} exercises',
      noTrainingDays: 'Add at least one exercise to one of the days',
      unknownExercise: 'Day {day}: "{name}" is not in the exercise list',
      invalidTarget: 'Day {day}: check the target sets, reps and weight for {name}',
      dbNotReady:
        'Database not ready for programs (workout_programs table missing). Run server/sql/schema.sql in the Supabase SQL Editor, or set DATABASE_URL in server/.env and restart the server',
    },
    email: {
      verify: {
        subject: 'Your SupportFit verification code',
        heading: 'Verify your email',
        intro: 'Thanks for signing up for SupportFit! Enter the code below in the app to verify your email and get started.',
      },
      reset: {
        subject: 'Your SupportFit password reset code',
        heading: 'Reset your password',
        intro: 'We received a request to reset the password for your account. Enter the code below in the app to continue.',
      },
      preheader: 'Your code is {code} · expires in {minutes} minutes',
      codeLabel: 'Verification code',
      codeLine: 'Verification code: {code}',
      expiry: 'This code expires in <strong>{minutes} minutes</strong> and can only be used once.',
      expiryText: 'This code expires in {minutes} minutes and can only be used once.',
      securityNote: 'The SupportFit team will never ask you for this code. Do not share it with anyone.',
      ignoreNote: "If you didn't request this, you can safely ignore this email — your account won't be changed.",
      sentTo: 'Sent to {email}',
    },
  },

  th: {
    validation: {
      invalidEmail: 'รูปแบบอีเมลไม่ถูกต้อง',
      passwordTooShort: 'รหัสผ่านต้องมีอย่างน้อย {min} ตัวอักษร',
      emailAndPasswordRequired: 'กรุณากรอกอีเมลและรหัสผ่าน',
      emailAndCodeRequired: 'กรุณากรอกอีเมลและรหัส 6 หลักให้ถูกต้อง',
    },
    otp: {
      sent: 'ส่งรหัสยืนยันไปที่ {email} แล้ว',
      waitBeforeResend: 'กรุณารออีก {seconds} วินาทีก่อนขอรหัสใหม่',
      invalid: 'รหัสไม่ถูกต้อง กรุณาลองใหม่',
      expired: 'รหัสหมดอายุแล้ว กรุณากดขอรหัสใหม่',
      notFound: 'ไม่พบรหัสสำหรับอีเมลนี้หรือรหัสหมดอายุแล้ว กรุณากดขอรหัสใหม่',
      tooManyAttempts: 'กรอกรหัสผิดหลายครั้งเกินไป กรุณากดขอรหัสใหม่',
    },
    mail: {
      notConfigured: 'ยังไม่ได้ตั้งค่าอีเมลผู้ส่ง กรุณาใส่ RESEND_API_KEY ใน server/.env',
      unavailable: 'ระบบส่งอีเมลยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง',
      sendFailed: 'ส่งอีเมลไม่สำเร็จ กรุณาตรวจสอบ RESEND_API_KEY หรือลองใหม่อีกครั้ง',
      genericSendFailed: 'ส่งรหัสไม่สำเร็จ',
    },
    auth: {
      emailTaken: 'อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ',
      signupFailed: 'สมัครสมาชิกไม่สำเร็จ',
      noSignup: 'ไม่พบการสมัครสมาชิกของอีเมลนี้ กรุณาสมัครสมาชิกก่อน',
      alreadyVerified: 'บัญชีนี้ยืนยันอีเมลแล้ว กรุณาเข้าสู่ระบบ',
      loginFailed: 'เข้าสู่ระบบไม่สำเร็จ',
      wrongCredentials: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
      unverified: 'บัญชียังไม่ได้ยืนยันอีเมล กรุณากรอกรหัส OTP ที่ส่งไปที่อีเมล',
      forgotPasswordSent:
        'หากอีเมลนี้มีบัญชีที่ยืนยันแล้ว เราได้ส่งรหัส 6 หลักไปให้แล้ว กรุณาตรวจสอบกล่องจดหมาย (รวมถึงโฟลเดอร์ Spam)',
      passwordResetDone: 'ตั้งรหัสผ่านใหม่สำเร็จ ออกจากระบบทุกอุปกรณ์แล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่',
      passwordResetFailed: 'ตั้งรหัสผ่านใหม่ไม่สำเร็จ',
      noToken: 'ไม่พบสิทธิ์เข้าถึง กรุณาเข้าสู่ระบบ',
      sessionExpired: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
      sessionRevoked: 'เซสชันถูกยกเลิก กรุณาเข้าสู่ระบบใหม่',
      sessionCheckFailed: 'ตรวจสอบเซสชันไม่สำเร็จ',
      userNotFound: 'ไม่พบบัญชีผู้ใช้ กรุณาเข้าสู่ระบบใหม่',
    },
    parser: {
      textRequired: 'กรุณาระบุข้อความที่ต้องการแปลง',
      notUnderstood: 'ไม่เข้าใจคำสั่งนี้',
    },
    meal: {
      aiUnavailable: 'ยังไม่ได้ตั้งค่า AI วิเคราะห์อาหาร กรุณาใส่ GEMINI_API_KEY ใน server/.env',
      notFood: 'ไม่พบอาหารหรือเครื่องดื่มในข้อความนี้',
      analyzeFailed: 'AI วิเคราะห์อาหารไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
      timeout: 'AI ตอบกลับช้าเกินไป กรุณาลองใหม่อีกครั้งในอีกสักครู่',
      busy: 'ตอนนี้มีผู้ใช้ AI จำนวนมาก กรุณาลองใหม่อีกครั้งในอีกสักครู่',
      modelUnavailable: 'โมเดล AI ที่ตั้งไว้ใช้งานไม่ได้ กรุณาตรวจสอบ GEMINI_MODEL ใน server/.env',
    },
    data: {
      profileLoadFailed: 'ไม่สามารถโหลดโปรไฟล์ผู้ใช้ได้',
      profileSaveFailed: 'บันทึกโปรไฟล์ไม่สำเร็จ',
      invalidProfile: 'กรุณาตรวจสอบข้อมูล: {field} ไม่ได้กรอกหรือไม่อยู่ในช่วงที่ถูกต้อง',
      profileDbNotReady:
        'ฐานข้อมูลยังไม่พร้อมสำหรับโปรไฟล์ (ตาราง users ยังไม่มีคอลัมน์ onboarding) กรุณารัน server/sql/schema.sql ใน Supabase SQL Editor หรือตั้ง DATABASE_URL ใน server/.env แล้ว restart server',
      forbiddenRead: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้',
      forbiddenWrite: 'ไม่มีสิทธิ์บันทึกข้อมูลของผู้ใช้อื่น',
      ownershipCheckFailed: 'ตรวจสอบสิทธิ์ไม่สำเร็จ',
      workoutLoadFailed: 'ไม่สามารถโหลด workout logs ได้',
      workoutHistoryFailed: 'ไม่สามารถตรวจสอบสถิติเดิมได้',
      workoutSaveFailed: 'บันทึก workout log ไม่สำเร็จ',
      foodLoadFailed: 'ไม่สามารถโหลด food logs ได้',
      foodSaveFailed: 'บันทึก food log ไม่สำเร็จ',
      nameRequired: 'กรุณากรอกชื่อ',
      invalidNumber: '{field} ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป',
      logNotFound: 'ไม่พบรายการนี้ หรือรายการถูกลบไปแล้ว',
      deleteFailed: 'ลบรายการไม่สำเร็จ',
      dbNotReady:
        'ฐานข้อมูลยังไม่พร้อม (ไม่พบคอลัมน์ users.email หรือตาราง otp_codes) กรุณาตั้ง DATABASE_URL ใน server/.env แล้ว restart server หรือรัน npm run migrate',
    },
    programs: {
      loadFailed: 'ไม่สามารถโหลดโปรแกรมฝึกได้',
      saveFailed: 'บันทึกโปรแกรมไม่สำเร็จ',
      deleteFailed: 'ลบโปรแกรมไม่สำเร็จ',
      activateFailed: 'ตั้งโปรแกรมที่ใช้ไม่สำเร็จ',
      notFound: 'ไม่พบโปรแกรมนี้',
      presetReadOnly: 'โปรแกรมสำเร็จรูปแก้ไขไม่ได้ กรุณาสร้างโปรแกรมของคุณเอง',
      titleRequired: 'กรุณากรอกชื่อโปรแกรม',
      titleTooLong: 'ชื่อโปรแกรมยาวได้ไม่เกิน {max} ตัวอักษร',
      daysRequired: 'กรุณาเพิ่มอย่างน้อย 1 วัน',
      tooManyDays: 'โปรแกรมมีได้ไม่เกิน {max} วัน',
      tooManyExercises: 'วันที่ {day} มีท่าได้ไม่เกิน {max} ท่า',
      noTrainingDays: 'กรุณาเพิ่มท่าอย่างน้อย 1 ท่าในวันใดวันหนึ่ง',
      unknownExercise: 'วันที่ {day}: ไม่พบท่า "{name}" ในรายการท่า',
      invalidTarget: 'วันที่ {day}: กรุณาตรวจเซต ครั้ง และน้ำหนักเป้าหมายของ {name}',
      dbNotReady:
        'ฐานข้อมูลยังไม่พร้อมสำหรับโปรแกรมฝึก (ไม่พบตาราง workout_programs) กรุณารัน server/sql/schema.sql ใน Supabase SQL Editor หรือตั้ง DATABASE_URL ใน server/.env แล้ว restart server',
    },
    email: {
      verify: {
        subject: 'รหัสยืนยัน SupportFit',
        heading: 'ยืนยันอีเมลของคุณ',
        intro: 'ขอบคุณที่สมัครสมาชิก SupportFit! กรอกรหัสด้านล่างในแอปเพื่อยืนยันอีเมลและเริ่มใช้งาน',
      },
      reset: {
        subject: 'รหัสรีเซ็ตรหัสผ่าน SupportFit',
        heading: 'ตั้งรหัสผ่านใหม่',
        intro: 'เราได้รับคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ กรอกรหัสด้านล่างในแอปเพื่อดำเนินการต่อ',
      },
      preheader: 'รหัสของคุณคือ {code} · หมดอายุใน {minutes} นาที',
      codeLabel: 'รหัสยืนยัน · Verification code',
      codeLine: 'รหัสยืนยัน: {code}',
      expiry: 'รหัสนี้จะหมดอายุใน <strong>{minutes} นาที</strong> และใช้ได้เพียงครั้งเดียว',
      expiryText: 'รหัสนี้จะหมดอายุใน {minutes} นาที และใช้ได้เพียงครั้งเดียว',
      securityNote: 'ทีมงาน SupportFit จะไม่ขอรหัสนี้จากคุณทุกกรณี ห้ามแชร์รหัสให้ผู้อื่น',
      ignoreNote: 'หากคุณไม่ได้ทำรายการนี้ สามารถละเว้นอีเมลฉบับนี้ได้อย่างปลอดภัย บัญชีของคุณจะไม่ถูกเปลี่ยนแปลง',
      sentTo: 'ส่งถึง {email}',
    },
  },
}

const SUPPORTED = Object.keys(MESSAGES)
const DEFAULT_LANG = 'en'

// 'th', 'th-TH', 'th,en;q=0.9' -> 'th' ; อื่นๆ -> 'en'
function resolveLang(header) {
  const primary = String(header || '').split(',')[0].trim().slice(0, 2).toLowerCase()
  return SUPPORTED.includes(primary) ? primary : DEFAULT_LANG
}

function lookup(lang, key) {
  return key.split('.').reduce((node, part) => node?.[part], MESSAGES[lang])
}

function translate(lang, key, params = {}) {
  const template = lookup(lang, key) ?? lookup(DEFAULT_LANG, key) ?? key
  if (typeof template !== 'string') return template
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
}

// Express middleware: แนบ req.lang และ req.t(key, params)
function i18nMiddleware(req, _res, next) {
  req.lang = resolveLang(req.headers['accept-language'])
  req.t = (key, params) => translate(req.lang, key, params)
  next()
}

module.exports = { i18nMiddleware, translate, resolveLang }
