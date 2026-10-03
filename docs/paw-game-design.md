# วงล้ออุ้งเท้า — รูปแบบเกมและระบบกลาง

## วิเคราะห์ภาพต้นแบบ

ภาพแบ่งความสำคัญเป็น 4 ชั้น: ข้อมูลสมาชิกและสิทธิ์ด้านบน, ความคืบหน้ายอดซื้อ, วงล้อเป็นจุดหลักกลางฉาก, และปุ่มหมุนขนาดใหญ่ด้านล่าง กติกา ประวัติ และรางวัลควรอยู่ในหน้าต่างแยก เพื่อไม่บังวงล้อระหว่างเล่น

สีหลักคือสีน้ำเงินสด เขียว ส้ม และทอง ฉากร้านใช้สีน้ำตาลไม้และแสงอุ่น ตัวละครช่วยให้เกมดูเป็นร้านสัตว์เลี้ยง ไม่จำเป็นต้องใช้ภาพถ่ายขนาดใหญ่เป็นพื้นหลัง ทั้งวงล้อ ฐาน ชั้นสินค้า น้องหมา และน้องแมวเป็นโมเดล Three.js ที่มีวัสดุและไฟจริง ตัวละครเป็นรูปแบบการ์ตูนทรงเรียบ ไม่ใช่โมเดลขนละเอียดเหมือนภาพต้นแบบ

วงล้อมีความหนา ช่องรางวัลยกนูน ขอบทอง หลอดไฟ หัวอุ้งเท้า และตัวชี้ที่อยู่กับที่ มุมหยุดคำนวณจากช่องรางวัลที่เซิร์ฟเวอร์ยืนยัน ไม่สุ่มผลใหม่จากตำแหน่งกราฟิก ปกติใช้เวลาหมุนประมาณ 5.2 วินาที ลดเหลือ 0.8 วินาทีเมื่อผู้ใช้เปิด reduced motion

## ฝั่งสมาชิก

- หน้าลุ้นรางวัลในเมนูเดิม แสดงรูปโปรไฟล์ แต้ม สิทธิ์ และยอดที่ยังขาด
- รายการกิจกรรมเลือกได้เมื่อร้านเปิดมากกว่า 1 กิจกรรม
- หมุนจริงใช้ 1 สิทธิ์ โหมดฝึกไม่เรียก API แจกของจริงและไม่ใช้สิทธิ์
- ผลรางวัลเปิดตรงกลางจอ แต้มเข้าบัญชีทันทีหลังเซิร์ฟเวอร์บันทึก
- คูปองและสินค้าอยู่ในรางวัลของฉัน พร้อม QR เงื่อนไข และเวลาใช้ได้
- ประวัติแสดง 100 รอบล่าสุด ไม่อ้างว่าเป็นประวัติทั้งหมด
- ตรวจข้อมูลเมื่อกลับมาที่หน้า ทุก 30 วินาทีขณะมองเห็น และทุก 5 วินาทีขณะเปิด QR

## สิทธิ์จากยอดซื้อ

เจ้าของร้านตั้งยอดบาทต่อ 1 สิทธิ์ เช่น 500 บาท ยอดซื้อ 350 + 200 บาท ได้ 1 สิทธิ์และเหลือ 50 บาท ยอดเก่าก่อนเปิดระบบไม่ถูกนำมาสร้างสิทธิ์ย้อนหลัง สิทธิ์ไม่มีหมดอายุในเวอร์ชันนี้ และไม่มีแจกฟรีรายวัน

ใช้ยอด `earn` ที่บันทึกจริงใน `points_transactions` เท่านั้น แต้มปรับปรุง รางวัลแต้ม และโบนัสแรงก์ไม่สร้างสิทธิ์เพิ่ม ปิดการสะสมสิทธิ์ได้โดยไม่ปิดเกม และพักเกมได้โดยไม่ปิดการสะสม

แต่ละยอดซื้อเก็บเกณฑ์บาทที่ใช้ ณ เวลานั้น เมื่อลบหรือยกเลิกรายการ ระบบคำนวณยอดสะสมใหม่ตามเกณฑ์เดิม สิทธิ์ที่ใช้แล้วไม่ย้อนผลรางวัล แต่สร้างยอดสิทธิ์ติดลบภายในเพื่อให้ยอดซื้อถัดไปชดเชยก่อน หน้าสมาชิกแสดงจำนวนพร้อมเล่นอย่างน้อย 0 และอธิบายการชดเชย

## รางวัล

มีแต้ม คูปองส่วนลดเป็นเปอร์เซ็นต์/จำนวนบาท และสินค้า เจ้าของร้านเพิ่มรูป สี และชื่อแต่ละช่องได้ คูปองกำหนดยอดขั้นต่ำและเพดานส่วนลดได้ คูปองและสินค้ากำหนดอายุเป็นชั่วโมงจากเวลาที่ได้รับ หรือวันเวลาแน่นอนในประเทศไทยได้

กำหนดเรทการออกแต่ละช่องได้อิสระ 0–100,000 รองรับทศนิยม 2 ตำแหน่ง ไม่ต้องรวมเป็น 100 เรท 20 มีโอกาสเป็นสองเท่าของเรท 10 และเรท 0 ไม่ออก ต้องมีอย่างน้อยหนึ่งช่องเปิดใช้ที่เรทมากกว่า 0 รางวัลสต็อกหมดหรือหมดอายุไม่อยู่ในผลสุ่ม ระบบปรับสัดส่วนเฉพาะช่องที่เหลือ หากไม่เหลือรางวัลจะปฏิเสธรอบโดยไม่หักสิทธิ์ ขนาดช่องเป็นภาพประกอบ ไม่ใช่การแสดงสัดส่วนโอกาส

การสุ่มใช้เลขสุ่มจาก `node:crypto` ฝั่งเซิร์ฟเวอร์ โอกาส สต็อก และสถานะเปิดช่องเก็บในตารางปิด ไม่มีสิทธิ์อ่านด้วย anon/authenticated หน้าสมาชิกใช้รายการฟิลด์ที่อนุญาตเท่านั้น

## ฝั่งแอดมิน

เจ้าของร้านแก้ไขและบันทึกกิจกรรมได้ ผู้จัดการดูข้อมูลและรับรางวัลได้ พนักงานดูประวัติและรับรางวัลได้ แต่ไม่ได้รับการตั้งค่าเปอร์เซ็นต์จาก API

เพิ่มกิจกรรมวงล้อใหม่ได้โดยแยกชื่อและรหัสกิจกรรม ใช้สิทธิ์กลางของร้านร่วมกัน เริ่มต้นกิจกรรมใหม่แบบพักให้บริการ ต้องบันทึกและเปิดใช้ก่อนสมาชิกเห็น ฉากตัวอย่างปรับตามช่องที่กำลังแก้ไข

หน้ารับรางวัลอ่าน QR ด้วยกล้องหรือวางรหัส ตรวจวันหมดอายุ เจ้าของร้าน สมาชิก และการใช้ซ้ำ คูปองต้องกรอกยอดซื้อจริง เซิร์ฟเวอร์ตรวจยอดขั้นต่ำและคำนวณส่วนลด/เพดานก่อนยืนยัน พนักงานต้องใช้ส่วนลดหรือส่งมอบสินค้าเอง ระบบนี้ไม่ได้ส่งคำสั่งเปลี่ยนราคาหรือหักสต็อกให้ POS ภายนอก

## ป้องกันการหักซ้ำและความขัดแย้ง

รอบมี request UUID เดียว บันทึกใน sessionStorage ก่อนเรียก API เซิร์ฟเวอร์ล็อกสมาชิก กระเป๋าสิทธิ์ และเกมใน transaction เดียว หักสิทธิ์ ตัดสต็อก แจกแต้ม/สิทธิ์ และเก็บประวัติพร้อมกัน ถ้าขั้นใดล้มเหลวทั้งหมด rollback

ส่ง UUID เดิมจะได้ผลเดิม แม้เกมพักหรือ version เปลี่ยนแล้ว หากเครือข่ายล้มเหลวจะเก็บ UUID เพื่อกู้รอบเดิม ไม่สร้างรอบใหม่ทันที ผลรอบและช่องที่ใช้หมุนเก็บเป็น snapshot จึงไม่เปลี่ยนตามการแก้กิจกรรมภายหลัง การตัดสต็อกเพิ่ม version เพื่อไม่ให้แอดมินบันทึกสต็อกเก่าทับ

## รองรับเกมในอนาคต

`crm_games` แยก game_key และ engine ส่วนกระเป๋าสิทธิ์ ยอดซื้อ ประวัติ และสิทธิ์รางวัลเป็นระบบกลาง

1. เพิ่ม engine และข้อกำหนดใน `lib/games/registry.ts`
2. ลงทะเบียน renderer ใน `components/games/game-stage.tsx`
3. เพิ่มตัวตรวจผลฝั่งเซิร์ฟเวอร์และ migration สำหรับเครื่องยนต์ใหม่ ห้ามยอมรับผลรางวัลที่ client ส่งมาเอง
4. เพิ่มแบบฟอร์มเฉพาะเกมในหน้าแอดมินและกติกาสมาชิก
5. ทดสอบใช้สิทธิ์ร่วมกัน กู้รอบเดิม และการแจกของแบบ atomic

เวอร์ชันนี้เปิดใช้ engine วงล้อจริง 1 แบบ และสร้างกิจกรรมวงล้อได้หลายกิจกรรม ยังไม่ได้เพิ่มเกมอีก 2 แบบหรือ level ที่มีรางวัลสูงขึ้นเอง

## ประสิทธิภาพและข้อจำกัด

ฉาก Three.js โหลดเฉพาะเมื่อเปิดเกม/หน้าตัวอย่าง จำกัด pixel ratio 1.6 และแผนที่เงา 1024px ไม่ render ขณะหน้าไม่อยู่ในจอหรือแท็บถูกซ่อน คืน geometry วัสดุ texture และ WebGL context เมื่อปิดหน้า รูปรางวัลย่อก่อนบันทึก

อุปกรณ์ที่เปิด WebGL ไม่ได้ยังรับผลรางวัลผ่าน UI ได้ การเล่นจริงต้องรอการยืนยันจากเซิร์ฟเวอร์ก่อนหมุนเพื่อรักษาความถูกต้อง ไม่รับประกันว่าไม่มีเวลาโหลด เครือข่ายครั้งแรกหรืออุปกรณ์ช้าอาจใช้เวลาเพิ่ม

## การเปิดใช้และการตรวจสอบ

หน้าฝึก `/customer/games-preview` เป็นสาธารณะและไม่มีของรางวัลจริง หน้าแอดมิน `/games` ต้องเข้าสู่ระบบ

ฐานข้อมูลใหม่อยู่ใน `supabase/migrations/20261003141506_game_platform.sql` และอาศัย migration ประวัติการยกเลิกรายการที่เรียงก่อนหน้า ยังไม่ใช้ฐานข้อมูลจริงจนได้รับอนุมัติ การทดสอบ `node tests/game-platform.mjs` ใช้ PGlite ใน `.tmp/transaction-verification` และไม่มีผลกับสมาชิกจริง

ก่อนใช้งานจริง ต้องติดตั้ง migration ตามลำดับในฐานทดสอบ ตรวจสมาชิกทดสอบซื้อ→เล่น→รับ QR แล้วจึงเปิด migration ระบบจริงและตั้งค่าเปอร์เซ็นต์/สต็อกจริง กิจกรรมเริ่มพักให้บริการจนเจ้าของร้านบันทึกเอง


## Shared purchase settings and manual tickets
Purchase threshold and earning switch are edited from the game library using save_game_program with an expected-value check. Saving a game's prizes does not overwrite existing shared purchase settings.
Owners can search active members in their store and give 1–10,000 tickets with a note. give_game_tickets uses a request UUID for idempotent retries, validates store ownership, and records an audit event and game_manual_tickets ledger. Purchase cancellation recomputes earned tickets while preserving manual tickets and spent-ticket debt. The game platform, reversal journal, transaction metadata, and paused starter wheel were activated on the production project after explicit approval on 4 October 2026. Save, toggle, manual-ticket idempotency, and reversal paths were verified in a rolled-back transaction.


## Temporary test rights (current behavior)
The manual button gives temporary test rights kept only in server memory for one hour, or until the server instance restarts. It does not insert game_manual_tickets or credit game_wallets. Purchase-based rights still come only from earn transactions recorded by the points flow; rank bonuses and zero-sale game rewards do not earn purchase tickets.
Member status separates temporary testBalance from the persisted wallet. A test-right draw uses the same real prize, stock, expiry and claim logic, without consuming or crediting the purchase wallet. Actual plays and prizes remain recorded for idempotency and fulfillment. This testing feature relies on the same live server instance; it is not intended as a durable multi-instance promotional ticket system.
The actor-verification helper is private, callable only by service_role, and reads confirmed-account status with its own restricted definer privileges. Real REST calls and database tests now use service_role rather than only setting a JWT role claim on a privileged SQL session.
