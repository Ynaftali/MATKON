# MATKON — תוכנית עבודה: מ-UX/UI עד פרודקשן

מסמך זה מסכם את כל מה שנשאר כדי להעביר את סבב ה-UX/UI (branch `ux-redesign-preview`) לפרודקשן, כולל **רשימת הקומפוננטים** לחילוץ/החלפה. הביצוע מיועד לסשן חדש (כנראה מודל FABLE). מקורות רקע: `ux_ui_v0.1.md`, `design-backup/MATKON_approved_designs.pdf`, ומסמכי `legal/`.

---

## חלק א — רשימת הקומפוננטים (מדויקת, מהקוד 14.7)

### ✅ כבר משותפים (קיימים, לא לגעת)
`AppHeader` · `BottomNav` · `CountrySelect` · `SsoButtons` · `NameFields` · `PasswordInput` (+`lib/passwordRules.js`) · `MatkonLogo` · `NotificationsBell` · `PasskeySection` · `PasskeyOfferModal` · `ImageRejectionModal` · `RecipeCard` · `LegalPage`

### 🔧 C. לאמץ — להחליף markup משוכפל בקומפוננט קיים
| # | קומפוננט | להחליף איפה | הערה |
|---|----------|-------------|------|
| C1 | **AppHeader** | Feed, Recipes, Shopping, AddRecipe, EditRecipe (הדר app-head/topbar inline) | הדר האפליקציה (לוגו+חץ+כותרת) |
| C2 | **AppHeader** (variant auth) | Login, Register, VerifyEmail, SSOCountry, CompleteProfile (הדר `.auth-top` inline) | ⚠️ לוודא התאמה חזותית מלאה ל-`.auth-top` לפני החלפה; אם שונה מהותית — להשאיר או להוסiff prop |
| C3 | **RecipeCard** | Feed, Recipes (כרגע `.rcard` inline; רק Profile משתמש בקומפוננט) | תצוגה קנונית זהה |

### 🆕 B. לחלץ — קומפוננטים חדשים לבנות (שכפול AddRecipe ↔ EditRecipe בעיקר)
| # | קומפוננט | משוכפל בין | תיאור |
|---|----------|-----------|-------|
| B1 | **IngredientEditor** | AddRecipe ↔ EditRecipe | עורך מצרכים (שם/כמות/יחידה, הוספה/מחיקה) |
| B2 | **StepEditor** | AddRecipe ↔ EditRecipe | עורך שלבי הכנה (טקסט, סינון ריקים, resize:none) |
| B3 | **TagInput** | AddRecipe ↔ EditRecipe | קלט תגיות + השלמה אוטומטית מ-`allTags` |
| B4 | **VisibilityPicker** | AddRecipe ↔ EditRecipe | בורר נראות (שיתוף=ירוק / פרטי=סגול) |
| B5 | **Drawer** | Profile (edit/privacy/delete-confirm), Shopping (library) | מעטפת `drawer-overlay`/`drawer` חוזרת |
| B6 | **Tabs** | Recipes (4 טאבים), Profile | שורת טאבים |
| B7 | **EmptyState** | Recipes (יש), Profile, Shopping (inline) | מצב-ריק (אייקון/כותרת/כפתור) |
| B8 | **Toast** | Profile, RecipePage, CookingMode (`setToast` inline) | הודעת אישור צפה |
| B9 | **UserIdentity** | Profile, RecipePage, Feed, Recipes (תצוגת `countryFlag`+שם) | שם משתמש + דגלים. **סדר קנוני נעול (14.7): דגל ישראל מימין, דגל מדינת-המשתמש משמאל** (כמו Feed/Recipes/RecipePage). **מתקן באג:** Profile כרגע הפוך (ישראל שמאל/מדינה ימין) — ליישר לקנוני. הקומפוננט אוכף את הסדר בכל מקום. |

**עיקרון:** כל החלפה = **אפס שינוי חזותי**. חלק אחד בכל פעם → preview → להשוות ל-PDF/git → הלאה. Smoke-test חזותי בלבד, לא עיצוב מחדש.

---

## חלק ב — תוכנית העבודה עד פרודקשן

### Phase 0 — הכנה (✅ בוצע, סשן זה)
- כל 17 המסכים אושרו; PDF גיבוי (`design-backup/`).
- תוכן משפטי (ToS+Privacy) נוסח + עמודי `/terms` `/privacy` נבנו.
- מודרציה (bio/תגובות/שם-בעריכה) — קוד + 2 מיגרציות **נכתבו** (לא הוחלו).

### Phase 1 — Componentization (סשן חדש, FABLE) — מכני
לפי הרשימה למעלה, בסדר: C1→C3 (הדר+כרטיס, הכי נפוץ) → B1–B4 (עורכי Add/Edit) → B5–B8 (Drawer/Tabs/EmptyState/Toast).
אחרי כל קומפוננט: build + preview + השוואה חזותית. commit קטן per-component.

**🚩 החלטת גיאומטריית הדר נעולה (15.7):** גוטר אחיד **16px** בכל האפליקציה (חץ 16px מהקצה, לוגו 16px מלמעלה). קדם לכך היו 3 גיאומטריות (0/16/24). המשתמש בחר 16px אחרי השוואה חזותית של שלושת המצבים זה-לצד-זה על מסך Recipes.

**✅ C1 — AppHeader אומץ (15.7):** Feed, Recipes, Shopping, AddRecipe, EditRecipe. `AppHeader` הורחב ב-2 props: `showBack` (מסתיר חץ, לשלב 4 של AddRecipe) + `compact` (`.auth-header.compact` margin-bottom 12px למסכי-רשימה מול 32px למסכי-טופס). נוקו: `paddingTop:20` inline מ-Recipes/Shopping, `padding-top:20px` מ-`.add-page`, `.feed-head` ל-`0 16px`. הפעמון ב-Feed עבר ל-prop `right`. הוסרו imports יתומים של `IconArrowRight`. אומת חי ב-375px: back 16px / logo 16px בכל 5 העמודים; Feed פיקסל-זהה (כבר היה 16px). build נקי.

**✅ C2 — AppHeader במסכי auth (15.7):** Login, Register, VerifyEmail, SSOCountry, CompleteProfile. `AppHeader` קיבל `children` (תת-כותרת משתנה בתוך `.auth-header`); CSS: `.auth-page:not(.legal-page) > .app-head { margin: -24px -24px 0 }` — ההדר יושב ב-16px בעוד תוכן הטופס נשאר בריפוד 24px (`.legal-page` מוחרג כי הריפוד שלו 0). אומת חי בכל 5 המסכים (back 16 / logo 16, טופס x=24) + `/terms` לא נפגע. הוסרו כל שאריות `IconArrowRight` מחוץ ל-AppHeader. **✅ C3 — RecipeCard משותף ב-Feed+Recipes (15.7):** נמחקו הכרטיסים המקומיים + עותקי `authorName` הכפולים; שני העמודים משתמשים ב-`components/RecipeCard`. **תוקן סדר-דגלים בקומפוננט המשותף לקנוני** (ישראל מימין; היה הפוך, השפיע רק על Profile עד עכשיו). בונוס מהקומפוננט: dedupe דגל למשתמש ישראלי (🇮🇱 אחד במקום כפול). אומת חי: Feed + Recipes/קהילה זהים, דגלים 🇳🇿→🇮🇱 בסדר קנוני, build+console נקיים. `authorName` נשאר משוכפל רק ב-RecipePage — יטופל ב-B9 (UserIdentity). **📌 לב-B9: המשתמש ביקש לתקן יישור אנכי של הדגלים למרכז גובה השם + להציג לאישור.** **✅ B1 — IngredientEditor (15.7):** `src/components/IngredientEditor.jsx` controlled (`ingredients`+`onChange`); AddRecipe שלב 3 + EditRecipe מאמצים, נמחקו `setIng/addIng/delIng` הכפולים משני הקבצים. אומת חי (bypass זמני `?step=3`, הוסר): רינדור זהה + הוספה/הקלדה/מחיקה עובדים. **הבא: B2 (StepEditor) — ממתין לאישור.**

### Phase 2 — ניקוי לפני merge
- **להסיר** `TEMP-PREVIEW` bypass ב-`RequireAuth` (`src/App.jsx`, `import.meta.env.DEV && ?preview=1`).
- **להסיר** seed/mock ה-preview ב-`Profile.jsx` (וכל שאריות `?preview=1`).
- אימות: אין `preview=1` פעיל; `npm run build` + `npm run lint` נקי.

### Phase 3 — סופיות משפטית (חסום externally — עו"ד NZ)
- אחרי ליטוש עו"ד: לנעול אנגלית → תרגום עברית סופי → לעדכן `legal/site/*.md` (העמודים יתעדכנו אוטומטית).
- להקים תיבות דואר: privacy@ / copyright@ / support@.
- אופציונלי: lazy-load לעמודי המשפט (חוסך ~65KB מה-bundle הראשי).

### Phase 4 — מיגרציות DB (apply-at-merge בלבד!)
- ⚠️ **אסור להחיל מוקדם.** `20260714120000_enforce_bio_moderation` + `20260714120100_enforce_comment_moderation` מסירות grants שה-main החי מסתמך עליהם.
- להחיל **יחד עם ה-merge** של הקוד; לאמת RLS/column-grants חי.

### Phase 5 — Merge & Deploy
- merge `ux-redesign-preview` → `main`.
- deploy (Vercel); המיגרציות מוחלות.
- smoke-test בפרודקשן (זרימות מפתח).

### Phase 6 — E2E מהנייד (המשתמש)
- המשתמש עובר על הזרימות במובייל → מאתר פערים → תיקונים.

### Phase 7 — Backlog אחרי השקה
- ⭐ find-rare #1 (Sonnet+prompt+בדיקה חיה).
- 🔴 full_name בהרשמה (מודרציה, דרך `/api/register`).
- חותמת AI על תמונות (EU AI Act §50); נרמול שם מצרך; קטגוריית "כללי"; ייצוא-נתונים-למייל; reset-password.

---

## תזכורות קריטיות
- **המיגרציות = apply-at-merge**, לא לפני.
- **להסיר TEMP-PREVIEW bypass + Profile seed** לפני merge.
- כל שינוי קומפוננט = אפס רגרסיה חזותית (השוואה ל-PDF/git).
- Add/Edit לא ב-PDF (auth-gated) — עיצוב ב-git+ux_ui.
