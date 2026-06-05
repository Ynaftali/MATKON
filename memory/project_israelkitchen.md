---
name: project-israelkitchen
description: מצב עדכני של פרויקט IsraelKitchen — רשת חברתית למתכונים
metadata:
  type: project
---

IsraelKitchen — רשת חברתית למתכונים של ישראלים בחו"ל.

**Why:** בניית MVP לפרויקט חברתי עם React + Vite + Supabase + Vercel.

**How to apply:** בכל שיחה על IsraelKitchen — לטעון הקשר זה ולהמשיך מאותה נקודה.

## Stack
- Frontend: React + Vite — `/Users/naftali/claudecode/israelkitchen`
- Backend: Supabase — `https://txstregguvnuyyxensun.supabase.co`
- Env: `.env` עם VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
- Dev server: `npm run dev` → http://localhost:5173

## מה נבנה (מלא)
כל 8 המסכים מהבריף `Brief/israelkitchen_claude_code_prompt.md`:
- `/` Splash, `/peek` Peek (4 slides), `/register`, `/login`, `/sso`, `/complete-profile`
- `/feed` Feed עם Supabase + mock data + פילטרים
- `/recipe/:id` RecipePage עם +/- מנות
- `/cook/:id` CookingMode עם טיימר
- `/add` AddRecipe — 4 שלבים (הזנה → AI → תגיות → שיתוף)
- `/profile` Profile, `/map` MapPage (Leaflet), `/community/:country`

## Supabase
טבלאות: users, recipes, ingredients, steps, communities, likes
RLS: מושבת על כל הטבלאות (supabase_rls.sql הורץ)
3 מתכונים ב-DB עם תמונות Unsplash:
- חומוס ביתי → photo-1637949385162-e416fb15b2ce
- שקשוקה קלאסית → photo-1614570218825-c2a3be79b0fd
- סלט ישראלי → photo-1512621776951-a57141f2eefd

## בעיה פתוחה — תמונות
תמונות Unsplash עדיין לא נראות בדפדפן (רק גרדיאנטים).
הגישה הנוכחית: `background-image` ישירות על ה-`.rcard` div (לא img tag).
הקובץ: `src/pages/Feed.jsx` — RecipeCard משתמש ב-bgStyle עם backgroundImage.
גם `src/pages/Peek.jsx` עודכן לאותה גישה.
**לבדוק מחר:** האם hard refresh (Cmd+Shift+R) פותר, האם יש חסימת CSP, ואם לא — לנסות proxy או תמונות מ-source אחר.

## Design
- Dark navy: #080d1c, Heebo font, RTL, Tabler Icons
- פלטת צבעים מ-Brief: --blue: #3d6fa8, --green: #5ecb8a, --text: #eef2ff
- Mobile-first, max-width 430px

## קבצים מרכזיים
- `src/lib/mock.js` — mock data עם image_url לכל 4 המתכונים
- `src/lib/supabase.js` — Supabase client
- `src/index.css` — כל ה-CSS (design system + כל הקומפוננטות)
- `src/App.jsx` — כל ה-routes
