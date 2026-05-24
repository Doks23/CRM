# Screenshot Capture Instructions

To complete the training manual, please capture the following screenshots from the live app.

## Credentials
- **URL**: https://whitepops-saathi.vercel.app/
- **Email**: pd@whitepops.com
- **Password**: (check the user's prompt for the actual password)

## Screenshot List

### Page Screenshots (24 total)

| # | Filename | Page/Action | Tips |
|---|---|---|---|
| 1 | `01-login.png` | Login page | Capture full page showing email/password form and "Continue with Google" |
| 2 | `02-navigation.png` | Sidebar fully visible | Go to any page, capture showing full left sidebar with all menu groups |
| 3 | `03-dashboard.png` | Dashboard | Capture full page scroll showing all cards: KPI tiles, Today's Focus, Inbox Pulse, Pipeline Pulse, Saathi Activity |
| 4 | `04-inbox-overview.png` | Inbox main view | Capture all 3 panels: Left (folders), Middle (thread list), Right (empty or selected thread) |
| 5 | `05-inbox-thread.png` | Inbox with thread open | Click a thread in the list, capture showing email messages in right panel |
| 6 | `06-inbox-draft-panel.png` | Draft panel visible | If a thread has an AI draft generated, capture showing the draft panel at bottom. Or click "Generate Reply" and capture. |
| 7 | `07-pipeline.png` | Pipeline Kanban | Capture full width showing all 5 stage columns with lead cards |
| 8 | `08-pipeline-create-lead.png` | Create Lead dialog | Click "+ New Lead" button, capture the dialog open |
| 9 | `09-pipeline-assign.png` | Assign Lead dialog | Click "Assign" button (may need to select leads first), capture dialog open |
| 10 | `10-customers.png` | Customers page | Full page showing customers table and "Add Customer" button |
| 11 | `11-customers-edit.png` | Customer Add/Edit form | Click "Add Customer" or Edit button on an existing customer, capture form |
| 12 | `12-products.png` | Products page | Full page showing product catalog with all products listed |
| 13 | `13-products-add.png` | Add Product form | Click to add a new product, capture the form |
| 14 | `14-inventory.png` | Inventory page | Full page showing stock list |
| 15 | `15-inventory-movement.png` | Add Movement dialog | Click "Add Movement", capture dialog |
| 16 | `16-samples.png` | Samples page | Full page showing samples dispatch list |
| 17 | `17-samples-add.png` | Add Sample form | Click to add new sample dispatch, capture form |
| 18 | `18-reports.png` | Reports page (top) | Capture top portion showing Big Stats 4 cards |
| 19 | `19-reports-funnel.png` | Reports (middle) | Scroll down, capture Conversion Funnel and Inbox Health sections |
| 20 | `20-reports-leaderboard.png` | Reports (bottom) | Scroll to bottom, capture Leaderboard table |
| 21 | `21-employees.png` | Employees page | Note: Only visible to Owner role. Capture showing employee list |
| 22 | `22-settings.png` | Settings overview page | Capture showing all section cards with status badges |
| 23 | `23-settings-profile.png` | Settings → Company & voice | Click "Company & voice", capture that page (Brand Voice is important) |
| 24 | `24-settings-gmail.png` | Settings → Gmail connection | Click "Gmail connection" (Owner only), capture that page |

## How to Capture

1. **Login** at https://whitepops-saathi.vercel.app/
2. **Visit each page** using the sidebar navigation
3. **For dialogs/forms**: Click the button to open them first, then capture
4. **Full page**: Use your browser's full page screenshot feature:
   - **Chrome**: Press `Cmd+Shift+I` (DevTools), then `Cmd+Shift+P`, type "screenshot", select "Capture full size screenshot"
   - **Safari**: Right-click → "Inspect Element", then Cmd+Shift+P and search for screenshot
   - **Or** use your system screenshot tool and manually scroll/stitch
5. **Save** to `docs/screenshots/` folder with exact filenames above

## Important

- If capturing from **production**, be careful about **real customer data**. If needed, blur/obscure:
  - Customer names
  - Email addresses
  - Phone numbers
  - Company names
- The manual references these exact filenames, so use the exact names given

## Quick Test

After capturing, verify:
- [ ] All 24 files exist
- [ ] Filenames match exactly (including the numbering)
- [ ] Images are readable (not too blurry)
- [ ] Full page content is visible (not just above-the-fold)
