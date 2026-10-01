# LESCO Complaint Registration — Snapshot + Status Version 2.0

This project is the separate mobile complaint-registration app for the LESCO IT Support system. It keeps the existing complaint fields and adds only the requested snapshot and status features.

## Complaint fields
- Sub Division Code
- Operator Name
- Mobile Number
- Complaint Date
- Issue Type:
  - Snap Uploading
  - Level 1 Installation
  - Level 1 Application
  - Mobile Meter Reading
  - Others
- Issue / Problem

## Snapshot workflow
1. Tap **Add Snapshot**.
2. Choose **Take Photo with Camera** or **Choose from Gallery**.
3. The selected image is scaled to a maximum dimension of 1280 pixels.
4. It is converted to JPEG and compressed toward a target of about 500 KB while keeping reasonable quality.
5. The app first registers the complaint and receives the generated Ticket No.
6. The Ticket No. is stamped in the upper-right corner of the image.
7. The stamped/compressed image is sent to Apps Script.
8. Apps Script stores it in the Google Drive folder **Snapshots** and writes the view URL into the **Snapshot URL** column of the Tickets sheet.

## Complaint status
The app has a **Check Complaint Status** section. Enter the Ticket No. The app reads the existing ticket endpoint and displays:
- **Resolved** when backend status is Resolved or Closed
- **Pending** for New, In Progress, or Pending
- Resolution text when available
- View Snapshot button when a snapshot URL exists

## Google Apps Script update
The updated backend is in `Google Apps Script/Code.gs`. It preserves the existing ticket, email, FCM, report and resolve functions and adds:
- `Snapshot URL` sheet column
- `attachSnapshot` POST action
- Google Drive `Snapshots` folder handling
- snapshot URL in ticket object
- snapshot URL in the ticket email when available

### Deploying the backend
Use the **same Apps Script project/deployment** that already serves the Android app. In Apps Script:

1. Replace the existing `Code.gs` with `Google Apps Script/Code.gs`.
2. Save.
3. Run `setupTicketSystem()` once if prompted for permissions.
4. Make sure a Google Drive folder named **Snapshots** exists. If it does not exist, the code will create one automatically.
5. Open **Deploy → Manage deployments**. Edit the existing Web App deployment and deploy the new version.
6. Keep the existing Web App URL so the current system continues to use the same endpoint.

The code stores snapshots using a Drive view URL and attempts to set the file to **Anyone with the link → Viewer** so the Android status screen can open it without a Google Drive login. If your Google Workspace policy blocks link sharing, the Drive administrator must allow an appropriate sharing method.

## GitHub Actions
The project contains `.github/workflows/main.yml`. It builds a debug APK with Java 17 and uploads the APK as an Actions artifact.

## Important
The API key is currently embedded to match the existing backend. For production/public distribution, move it to a safer configuration or rotate it after testing.
