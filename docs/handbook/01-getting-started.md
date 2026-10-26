# 1. Getting started

## 1.1 Sign in — employee

### 1.1.1 Open the login

- Open the DigiLog address in the browser.
- On the marketing page, click **Log in**.
- Header shows **SSO Portal** and **Sign in to** DigiLog v2.

[Screenshot: 01-login-modal — Employee login, annotate: SSO Portal, Microsoft, Google, Sign in with credentials]

### 1.1.2 Sign-in methods

- **Sign in with Microsoft** (needs HTTPS).
- **Sign in with Google**.
- **Sign in with credentials:**
  - **Username or corporate email**
  - **Security key phrase / password**
  - **Sign In**
- **Forgot?** shows: *Contact your IT administrator for password reset.* There is no self-reset screen.

### 1.1.3 After a good login

- Toast: *Signed in successfully.*
- You land on **Home**, unless the link had `?next=` (email deep link).

### 1.1.4 Messages that block login

- Inactive: *Your account is deactivated. Contact your administrator.*
- No app access: *You do not have access to use this application. Please contact the administrator.*

## 1.2 Sign in — administrator

- **Plant admins** use the normal **Log in** (Microsoft, Google, or credentials). After sign-in they see **Config** in the navbar.
- `/admin/login` is only for the super admin **admin@gsma.com** (email and password). Microsoft and Google are not on this page.
- Anyone else on `/admin/login` sees: *You do not have permission to sign in on this page.*
- Super admin lands on **Config** → **Employees**.
- Link **← Back to employee login** returns to the public page.

[Screenshot: 01-admin-login — Administrator sign-in, annotate: Email, Password, Sign In as Admin]

## 1.3 Home

- Greeting: **Hello, {first name}**.
- Home is a picker, not a form.

### 1.3.1 Homepage cards

- **Forms Hub** → **Open Forms Hub** → operation forms and equipment.
- **BI Control Tower** → **Open BI Control Tower** → eight dashboards.
- Empty: **No homepage destinations assigned**.

[Screenshot: 01-home — Home with both cards, annotate: Forms Hub and BI Control Tower]

### 1.3.2 Who gets which card

- An administrator assigns **Forms Hub** and/or **BI Control Tower**.
- A card does not unlock every form. Forms and dashboards are mapped separately (see 8.1).

## 1.4 Navigation bar

Items appear only when you have access.

- **Home** — back to the two cards.
- **Maintenance Notes** — short notes (Sugar / Power / Production / Engineering). Distillery category does not see this.
- **Approvals** — HOD inbox.
- **Data Upload** — workbooks for dashboards.
- **Config** — administrators only.
- Bell — notifications.
- Avatar — profile photo.
- **Logout** — sign out.

[Screenshot: 01-navbar — Desktop navbar, annotate: gated items, bell, avatar, Logout]

### 1.4.1 Phone

- Open the hamburger menu.
- Same destinations as the desktop bar.

## 1.5 What you can see (access)

- Homepage cards: Forms Hub and/or BI Control Tower.
- App and form mapping: which Forms Hub cards and form rows you see.
- View only: *View only — you can see this data but cannot submit or edit.*
- Employee category: Notes plant lock (Sugar / Engineering → Sugar House; Power → Power Plant; Production → Production House).
- HOD assignment: **Approvals** in the navbar.
- Data Upload grant: which upload tabs you see.
- Locked-card manage: rename / move / delete imported equipment cards.

## 1.6 Staging banner

- Amber bar: *This environment is only for testing. Please use the production URL for business purposes.*
- **Caution.** Do not enter official shift data on staging.

## 1.7 Supported devices

- Desktop browser for forms, equipment, Config, and dashboards.
- Phone works for Home, Approvals, and Notes.
- Official browser list: `[TO CONFIRM]`.
