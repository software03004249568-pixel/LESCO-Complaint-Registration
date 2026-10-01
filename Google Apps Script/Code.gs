/*******************************************************
 * LESCO IT Directorate - Complaint Alert
 * Google Apps Script Backend
 *
 * Existing email recipients are preserved:
 *   1) software03004249568@gmail.com
 *   2) waqas.tiwana@lesco.gov.pk
 *
 * Android app reads new tickets through doGet().
 * The Android API is protected by API_KEY.
 *******************************************************/

const SPREADSHEET_ID = "1h1rFquzHA-HQ0Y4XCDI4WQ8QsB4ZBVijT2Nj3RcciDU";
const SPREADSHEET_NAME = "LESCO IT Directorate - Support Tickets";
const SHEET_NAME = "Tickets";

const EMAIL_TO = "software03004249568@gmail.com";
const EMAIL_TO_2 = "waqas.tiwana1@lesco.gov.pk";

const EMAIL_CC = "";
const EMAIL_BCC = "";

const API_KEY = "LESCO_IT_2026_9X7K2P5M8Q7A4";
const FIREBASE_PROJECT_ID = "lesco-complaint-alert";

const DEFAULT_STATUS = "New";
const DEFAULT_PRIORITY = "Normal";

const HEADERS = [
  "Timestamp",
  "Ticket No",
  "Sub Division Code",
  "Operator Name",
  "Mobile Number",
  "Date",
  "Issue Type",
  "Issue",
  "Level 1 Security Key",
  "Status",
  "Priority",
  "Assigned To",
  "Last Update",
  "Resolution",
  "Closed By",
  "Closed Date",
  "Remarks",
  "Snapshot URL"
];


/* ======================================================
   ONE-TIME SETUP
   ====================================================== */

function setupTicketSystem() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(SHEET_NAME);

  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
  }

  ensureHeaders(sh);
  formatTicketSheet(sh);

  PropertiesService.getScriptProperties()
    .setProperty("SPREADSHEET_ID", SPREADSHEET_ID);

  if (!PropertiesService.getScriptProperties().getProperty("LAST_TICKET_NUMBER")) {
    PropertiesService.getScriptProperties()
      .setProperty("LAST_TICKET_NUMBER", String(findLastTicketNumber_(sh)));
  }

  Logger.log("Spreadsheet: " + ss.getUrl());
  Logger.log("Sheet: " + sh.getName());
  Logger.log("Setup completed.");
}


/* ======================================================
   SHEET HEADERS / FORMATTING
   ====================================================== */

function ensureHeaders(sh) {
  const current = sh.getRange(1, 1, 1, HEADERS.length).getValues()[0];

  let different = false;

  for (let i = 0; i < HEADERS.length; i++) {
    if (current[i] !== HEADERS[i]) {
      different = true;
      break;
    }
  }

  if (different) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }

  sh.setFrozenRows(1);
}


function formatTicketSheet(sh) {
  ensureHeaders(sh);

  sh.getRange(1, 1, 1, HEADERS.length)
    .setFontWeight("bold")
    .setWrap(true);

  sh.getRange("A:A").setNumberFormat("yyyy-mm-dd hh:mm:ss");
  sh.getRange("F:F").setNumberFormat("yyyy-mm-dd");
  sh.getRange("M:M").setNumberFormat("yyyy-mm-dd hh:mm:ss");
  sh.getRange("P:P").setNumberFormat("yyyy-mm-dd");

  const lastRow = Math.max(sh.getLastRow(), 2);

  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(
      ["New", "In Progress", "Pending", "Resolved", "Closed"],
      true
    )
    .setAllowInvalid(false)
    .build();

  const priorityRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(
      ["Low", "Normal", "High", "Urgent"],
      true
    )
    .setAllowInvalid(false)
    .build();

  sh.getRange(2, 10, lastRow - 1, 1)
    .setDataValidation(statusRule);

  sh.getRange(2, 11, lastRow - 1, 1)
    .setDataValidation(priorityRule);

  sh.autoResizeColumns(1, HEADERS.length);

  sh.setColumnWidth(8, 360);
  sh.setColumnWidth(14, 300);
  sh.setColumnWidth(17, 300);
  sh.setColumnWidth(18, 360);
}


/* ======================================================
   GET API
   ====================================================== */

function doGet(e) {
  try {
    const p = (e && e.parameter) ? e.parameter : {};

    const action = String(
      p.action || "health"
    ).trim().toLowerCase();


    if (action === "health") {
      return out({
        success: true,
        service: "LESCO Complaint Alert API",
        time: new Date().toISOString()
      });
    }


    if (!isValidApiKey_(p.key)) {
      return out({
        success: false,
        message: "Unauthorized"
      });
    }


    if (action === "registerdevice") {
      return registerDevice_(
        String(p.token || "").trim(),
        String(p.userName || "").trim()
      );
    }


    if (action === "dashboard") {
      return getDashboard_();
    }

    // Date-range report endpoint. Existing email and DATA-ONLY FCM code remains unchanged.
    if (action === "report") {
      return getComplaintReport_(
        String(p.fromDate || "").trim(),
        String(p.toDate || "").trim()
      );
    }


    if (action === "tickets") {
      return getTickets_(p);
    }


    if (action === "pending") {
      return getPendingTickets_();
    }


    if (action === "resolve") {
      return resolveTicket_(
        String(p.ticketNo || "").trim(),
        String(p.resolution || "").trim(),
        String(p.closedBy || "").trim()
      );
    }


    if (action === "stats") {
      return getStats_();
    }


    if (action === "ticket") {
      return getSingleTicket_(
        String(p.ticketNo || "").trim()
      );
    }


    return out({
      success: false,
      message: "Unknown action"
    });


  } catch (err) {

    return out({
      success: false,
      message: String(err.message || err)
    });

  }
}


/* ======================================================
   POST API - CREATE TICKET
   ====================================================== */

function doPost(e) {

  const lock = LockService.getScriptLock();

  try {

    const p = (e && e.parameter) ? e.parameter : {};

    const action = String(
      p.action || "create"
    ).trim().toLowerCase();


    /* Android app: resolve an existing complaint. */

    if (action === "resolve") {

      if (!isValidApiKey_(p.key)) {

        return out({
          success: false,
          message: "Unauthorized"
        });

      }

      return resolveTicket_(
        String(p.ticketNo || "").trim(),
        String(p.resolution || "").trim(),
        String(p.closedBy || "").trim()
      );
    }

    /* Android app: attach a compressed, ticket-stamped snapshot. */
    if (action === "attachsnapshot") {

      if (!isValidApiKey_(p.key)) {
        return out({
          success: false,
          message: "Unauthorized"
        });
      }

      return attachSnapshotToTicket_(
        String(p.ticketNo || "").trim(),
        String(p.snapshotBase64 || "").trim(),
        String(p.snapshotMime || "image/jpeg").trim(),
        String(p.snapshotName || "").trim()
      );
    }


    if (!p.subDivisionCode) {
      throw new Error("Sub Division Code is required.");
    }

    if (!p.operatorName) {
      throw new Error("Operator Name is required.");
    }

    if (!p.mobileNo) {
      throw new Error("Mobile Number is required.");
    }

    if (!p.issueDate) {
      throw new Error("Date is required.");
    }

    if (!p.issueType) {
      throw new Error("Issue Type is required.");
    }

    if (!p.issue) {
      throw new Error("Issue is required.");
    }


    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    const sh = ss.getSheetByName(SHEET_NAME);

    if (!sh) {
      throw new Error("Tickets sheet was not found.");
    }

    ensureHeaders(sh);


    lock.waitLock(30000);


    let n = Number(
      PropertiesService.getScriptProperties()
        .getProperty("LAST_TICKET_NUMBER") || 0
    ) + 1;


    PropertiesService.getScriptProperties()
      .setProperty(
        "LAST_TICKET_NUMBER",
        String(n)
      );


    const now = new Date();

    const tz =
      Session.getScriptTimeZone() ||
      "Asia/Karachi";


    const ticketDate =
      Utilities.formatDate(
        now,
        tz,
        "yyyyMMdd"
      );


    const ticket =
      "TKT-" +
      ticketDate +
      "-" +
      String(n).padStart(5, "0");


    let securityKey = "";


    if (
      String(p.issueType).trim() ===
      "Level 1 Installation"
    ) {

      securityKey =
        generateSecurityKey(now);

    }

    const snapshotUrl = "";


    const row = [

      now,

      ticket,

      String(p.subDivisionCode).trim(),

      String(p.operatorName).trim(),

      String(p.mobileNo).trim(),

      String(p.issueDate).trim(),

      String(p.issueType).trim(),

      String(p.issue).trim(),

      securityKey,

      DEFAULT_STATUS,

      DEFAULT_PRIORITY,

      "",

      now,

      "",

      "",

      "",

      snapshotUrl

    ];


    sh.appendRow(row);

    SpreadsheetApp.flush();


    sendTicketEmail_(row);

    sendPushToDevices_(row);


    return out({

      success: true,

      ticketNo: ticket,

      securityKey: securityKey,

      status: DEFAULT_STATUS,
      snapshotUrl: snapshotUrl

    });


  } catch (err) {

    return out({

      success: false,

      message: String(
        err.message || err
      )

    });


  } finally {

    try {

      lock.releaseLock();

    } catch (_) {}

  }
}


/* ======================================================
   TICKET READ FUNCTIONS
   ====================================================== */

function getDashboard_() {

  const statsResponse =
    getStatsObject_();

  const pendingResponse =
    getPendingObject_();


  return out({

    success: true,

    stats: statsResponse,

    count:
      pendingResponse.tickets.length,

    tickets:
      pendingResponse.tickets

  });

}


function getPendingObject_() {

  const ss =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );


  const sh =
    ss.getSheetByName(
      SHEET_NAME
    );


  if (!sh) {
    throw new Error(
      "Tickets sheet was not found."
    );
  }


  ensureHeaders(sh);


  const lastRow =
    sh.getLastRow();


  if (lastRow < 2) {
    return {
      tickets: []
    };
  }


  const values =
    sh.getRange(
      2,
      1,
      lastRow - 1,
      HEADERS.length
    ).getValues();


  const tickets = [];


  for (
    let i = values.length - 1;
    i >= 0;
    i--
  ) {

    const item =
      rowToObject_(values[i]);


    const status =
      String(
        item.status || "New"
      )
        .trim()
        .toLowerCase();


    if (
      status !== "resolved" &&
      status !== "closed"
    ) {

      tickets.push(item);

    }

  }


  return {
    tickets: tickets
  };

}


function getStatsObject_() {

  const ss =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );


  const sh =
    ss.getSheetByName(
      SHEET_NAME
    );


  if (!sh) {
    throw new Error(
      "Tickets sheet was not found."
    );
  }


  ensureHeaders(sh);


  const stats = {

    total: 0,

    new: 0,

    inProgress: 0,

    pending: 0,

    resolved: 0,

    closed: 0,

    urgent: 0,

    high: 0

  };


  const lastRow =
    sh.getLastRow();


  if (lastRow < 2) {
    return stats;
  }


  const rows =
    sh.getRange(
      2,
      1,
      lastRow - 1,
      HEADERS.length
    ).getValues();


  stats.total =
    rows.length;


  rows.forEach(
    function(r) {

      const status =
        String(
          r[9] || "New"
        ).trim();


      const priority =
        String(
          r[10] || "Normal"
        ).trim();


      if (status === "New") {

        stats.new++;

      } else if (
        status === "In Progress"
      ) {

        stats.inProgress++;

      } else if (
        status === "Pending"
      ) {

        stats.pending++;

      } else if (
        status === "Resolved"
      ) {

        stats.resolved++;

      } else if (
        status === "Closed"
      ) {

        stats.closed++;

      }


      if (priority === "Urgent") {

        stats.urgent++;

      }


      if (priority === "High") {

        stats.high++;

      }

    }
  );


  return stats;

}


function getPendingTickets_() {

  const ss =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );


  const sh =
    ss.getSheetByName(
      SHEET_NAME
    );


  if (!sh) {
    throw new Error(
      "Tickets sheet was not found."
    );
  }


  ensureHeaders(sh);


  const lastRow =
    sh.getLastRow();


  if (lastRow < 2) {

    return out({

      success: true,

      tickets: [],

      count: 0

    });

  }


  const values =
    sh.getRange(
      2,
      1,
      lastRow - 1,
      HEADERS.length
    ).getValues();


  const tickets = [];


  /* Newest first. */

  for (
    let i = values.length - 1;
    i >= 0;
    i--
  ) {

    const item =
      rowToObject_(values[i]);


    const status =
      String(
        item.status || "New"
      )
        .trim()
        .toLowerCase();


    if (
      status !== "resolved" &&
      status !== "closed"
    ) {

      tickets.push(item);

    }

  }


  return out({

    success: true,

    count: tickets.length,

    tickets: tickets

  });

}


function getTickets_(p) {

  const ss =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );


  const sh =
    ss.getSheetByName(
      SHEET_NAME
    );


  if (!sh) {
    throw new Error(
      "Tickets sheet was not found."
    );
  }


  ensureHeaders(sh);


  const limit =
    Math.min(
      Math.max(
        Number(
          p.limit || 20
        ),
        1
      ),
      100
    );


  const after =
    String(
      p.after || ""
    ).trim();


  const lastRow =
    sh.getLastRow();


  if (lastRow < 2) {

    return out({

      success: true,

      tickets: [],

      count: 0

    });

  }


  const values =
    sh.getRange(
      2,
      1,
      lastRow - 1,
      HEADERS.length
    ).getValues();


  const tickets = [];


  for (
    let i = values.length - 1;
    i >= 0;
    i--
  ) {

    const r =
      values[i];


    const item =
      rowToObject_(r);


    if (
      after &&
      item.ticketNo === after
    ) {

      break;

    }


    tickets.push(item);


    if (
      tickets.length >= limit
    ) {

      break;

    }

  }


  return out({

    success: true,

    count: tickets.length,

    tickets: tickets

  });

}


function getSingleTicket_(ticketNo) {

  if (!ticketNo) {

    return out({

      success: false,

      message:
        "Ticket No is required."

    });

  }


  const ss =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );


  const sh =
    ss.getSheetByName(
      SHEET_NAME
    );


  const lastRow =
    sh.getLastRow();


  if (lastRow < 2) {

    return out({

      success: false,

      message:
        "No tickets found."

    });

  }


  const values =
    sh.getRange(
      2,
      1,
      lastRow - 1,
      HEADERS.length
    ).getValues();


  for (
    let i = 0;
    i < values.length;
    i++
  ) {

    const item =
      rowToObject_(
        values[i]
      );


    if (
      item.ticketNo === ticketNo
    ) {

      return out({

        success: true,

        ticket: item

      });

    }

  }


  return out({

    success: false,

    message:
      "Ticket not found."

  });

}


function attachSnapshotToTicket_(ticketNo, base64Data, mimeType, fileName) {
  if (!ticketNo) {
    return out({ success: false, message: "Ticket No is required." });
  }
  if (!base64Data) {
    return out({ success: false, message: "Snapshot image is required." });
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    return out({ success: false, message: "Tickets sheet was not found." });
  }

  ensureHeaders(sh);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) {
    return out({ success: false, message: "No tickets found." });
  }

  const values = sh.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][1] || "").trim() === ticketNo) {
      const url = saveSnapshot_(
        base64Data,
        mimeType || "image/jpeg",
        fileName || (ticketNo + ".jpg"),
        ticketNo
      );

      // Snapshot URL is column R (18).
      sh.getRange(i + 2, 18).setValue(url);
      sh.getRange(i + 2, 13).setValue(new Date());
      SpreadsheetApp.flush();

      return out({
        success: true,
        ticketNo: ticketNo,
        snapshotUrl: url
      });
    }
  }

  return out({ success: false, message: "Ticket not found." });
}


function resolveTicket_(
  ticketNo,
  resolution,
  closedBy
) {

  if (!ticketNo) {

    return out({

      success: false,

      message:
        "Ticket No is required."

    });

  }


  const ss =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );


  const sh =
    ss.getSheetByName(
      SHEET_NAME
    );


  if (!sh) {

    return out({

      success: false,

      message:
        "Tickets sheet was not found."

    });

  }


  const lastRow =
    sh.getLastRow();


  if (lastRow < 2) {

    return out({

      success: false,

      message:
        "No tickets found."

    });

  }


  const values =
    sh.getRange(
      2,
      1,
      lastRow - 1,
      HEADERS.length
    ).getValues();


  for (
    let i = 0;
    i < values.length;
    i++
  ) {

    const rowNumber =
      i + 2;


    const row =
      values[i];


    if (
      String(
        row[1] || ""
      ).trim() === ticketNo
    ) {

      const now =
        new Date();


      const tz =
        Session.getScriptTimeZone() ||
        "Asia/Karachi";


      /*
       * J = Status
       * M = Last Update
       * N = Resolution
       * O = Closed By
       * P = Closed Date
       */

      sh.getRange(
        rowNumber,
        10
      ).setValue(
        "Resolved"
      );


      sh.getRange(
        rowNumber,
        13
      ).setValue(now);


      sh.getRange(
        rowNumber,
        14
      ).setValue(
        resolution ||
        "Resolved from Complaint Alert app"
      );


      sh.getRange(
        rowNumber,
        15
      ).setValue(
        closedBy ||
        "Complaint Alert App"
      );


      sh.getRange(
        rowNumber,
        16
      ).setValue(now);


      return out({

        success: true,

        message:
          "Complaint resolved successfully.",

        ticketNo:
          ticketNo,

        status:
          "Resolved",

        resolvedAt:
          Utilities.formatDate(
            now,
            tz,
            "yyyy-MM-dd HH:mm:ss"
          )

      });

    }

  }


  return out({

    success: false,

    message:
      "Ticket not found."

  });

}


function getStats_() {

  return out({

    success: true,

    stats:
      getStatsObject_()

  });

}


/* ======================================================
   FCM PUSH NOTIFICATIONS
   ====================================================== */

function registerDevice_(
  token,
  userName
) {

  if (!token) {

    return out({

      success: false,

      message:
        "FCM token is required."

    });

  }


  const props =
    PropertiesService
      .getScriptProperties();


  let devices = {};


  try {

    devices =
      JSON.parse(
        props.getProperty(
          "FCM_DEVICES"
        ) || "{}"
      );

  } catch (_) {

    devices = {};

  }


  devices[token] = {

    userName:
      userName ||
      "Unknown User",

    updatedAt:
      new Date().toISOString()

  };


  props.setProperty(
    "FCM_DEVICES",
    JSON.stringify(devices)
  );


  return out({

    success: true,

    registered: true,

    userName:
      userName ||
      "Unknown User"

  });

}


/*
 * IMPORTANT:
 *
 * FCM is intentionally DATA-ONLY here.
 *
 * This allows Android's
 * ComplaintMessagingService.onMessageReceived()
 * to handle the notification itself.
 *
 * android.priority = HIGH
 */

function sendPushToDevices_(row) {

  const projectId =
    String(
      FIREBASE_PROJECT_ID ||
      ""
    ).trim();


  if (
    !projectId ||
    projectId.indexOf(
      "REPLACE_"
    ) === 0
  ) {

    console.log(
      "FCM disabled: FIREBASE_PROJECT_ID is not configured."
    );

    return;

  }


  const props =
    PropertiesService
      .getScriptProperties();


  let devices = {};


  try {

    devices =
      JSON.parse(
        props.getProperty(
          "FCM_DEVICES"
        ) || "{}"
      );

  } catch (_) {

    devices = {};

  }


  const tokens =
    Object.keys(devices);


  if (!tokens.length) {

    console.log(
      "FCM: no registered devices."
    );

    return;

  }


  const accessToken =
    ScriptApp.getOAuthToken();


  const endpoint =
    "https://fcm.googleapis.com/v1/projects/" +
    encodeURIComponent(projectId) +
    "/messages:send";


  const deadTokens = [];


  tokens.forEach(
    function(token) {

      const ticketNo =
        String(
          row[1] || ""
        );


      const subDivision =
        String(
          row[2] || ""
        );


      const issueType =
        String(
          row[6] || ""
        );


      const issue =
        String(
          row[7] || ""
        );


      const priority =
        String(
          row[10] ||
          "Normal"
        );


      /*
       * DATA-ONLY FCM MESSAGE
       *
       * No "notification" block here.
       *
       * Android ComplaintMessagingService
       * will receive this through
       * onMessageReceived().
       */

      const payload = {

        message: {

          token: token,

          data: {

            ticketNo:
              ticketNo,

            subDivisionCode:
              subDivision,

            issueType:
              issueType,

            issue:
              issue,

            priority:
              priority

          },


          android: {

            priority:
              "HIGH"

          }

        }

      };


      try {

        const response =
          UrlFetchApp.fetch(
            endpoint,
            {

              method:
                "post",

              contentType:
                "application/json",

              headers: {

                Authorization:
                  "Bearer " +
                  accessToken

              },

              payload:
                JSON.stringify(
                  payload
                ),

              muteHttpExceptions:
                true

            }
          );


        const code =
          response.getResponseCode();


        const body =
          response.getContentText();


        console.log(
          "FCM HTTP=" +
          code +
          " response=" +
          body
        );


        /*
         * Remove invalid / expired
         * FCM tokens.
         */

        if (
          code === 404 ||
          code === 400
        ) {

          try {

            const err =
              JSON.parse(
                body
              );


            const status =
              err &&
              err.error &&
              err.error.details &&
              err.error.details[0] &&
              err.error.details[0]
                .errorCode;


            if (
              status ===
              "UNREGISTERED"
            ) {

              deadTokens.push(
                token
              );

            }

          } catch (_) {}

        }

      } catch (err) {

        console.log(
          "FCM send exception: " +
          String(err)
        );

      }

    }
  );


  deadTokens.forEach(
    function(token) {

      delete devices[token];

    }
  );


  props.setProperty(
    "FCM_DEVICES",
    JSON.stringify(devices)
  );

}


/*
 * Form submission trigger.
 */

function onTicketFormSubmit(e) {

  try {

    if (
      !e ||
      !e.range
    ) {

      return;

    }


    const sh =
      e.range.getSheet();


    if (
      sh.getName() !==
      SHEET_NAME
    ) {

      return;

    }


    const row =
      sh.getRange(
        e.range.getRow(),
        1,
        1,
        HEADERS.length
      ).getValues()[0];


    sendPushToDevices_(
      row
    );


  } catch (err) {

    console.log(
      "onTicketFormSubmit error: " +
      String(err)
    );

  }

}


/*
 * Manual FCM test.
 *
 * It sends the latest ticket
 * to all registered devices.
 */

function testFCM() {

  const ss =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );


  const sh =
    ss.getSheetByName(
      SHEET_NAME
    );


  if (
    !sh ||
    sh.getLastRow() < 2
  ) {

    throw new Error(
      "No ticket found."
    );

  }


  const row =
    sh.getRange(
      sh.getLastRow(),
      1,
      1,
      HEADERS.length
    ).getValues()[0];


  sendPushToDevices_(
    row
  );

}


/* ======================================================
   EMAIL
   ====================================================== */

function authorizeMail() {
  // Run this function ONCE from Apps Script to authorize MailApp.
  // It does NOT send an email.
  const quota = MailApp.getRemainingDailyQuota();
  Logger.log("Mail permission authorized successfully. Remaining daily quota: " + quota);
}


function sendTicketEmail_(row) {

  const ticket =
    row[1];


  const subDivision =
    row[2];


  const operator =
    row[3];


  const mobile =
    row[4];


  const date =
    row[5];


  const issueType =
    row[6];


  const issue =
    row[7];


  const securityKey =
    row[8];


  const status =
    row[9];


  const priority =
    row[10];


  const subject =
    "New LESCO IT Support Ticket - " +
    ticket;


  let body =

    "LESCO IT Directorate - Support Ticket\n\n" +

    "Ticket No: " +
    ticket +
    "\n" +

    "Sub Division Code: " +
    subDivision +
    "\n" +

    "Operator Name: " +
    operator +
    "\n" +

    "Mobile Number: " +
    mobile +
    "\n" +

    "Date: " +
    date +
    "\n" +

    "Issue Type: " +
    issueType +
    "\n" +

    "Status: " +
    status +
    "\n" +

    "Priority: " +
    priority +
    "\n\n" +

    "Issue / Problem:\n" +

    issue;


  if (
    securityKey !== ""
  ) {

    body +=
      "\n\nSecurity Key = " +
      securityKey;

  }


  if (row[17]) {
    body +=
      "\n\nSnapshot: " +
      String(row[17]);
  }


  body +=

    "\n\nThis ticket was submitted automatically from " +

    "LESCO IT Support Ticket System.";


  const options = {};


  if (
    EMAIL_CC.trim()
  ) {

    options.cc =
      EMAIL_CC.trim();

  }


  if (
    EMAIL_BCC.trim()
  ) {

    options.bcc =
      EMAIL_BCC.trim();

  }


  MailApp.sendEmail(

    EMAIL_TO +
      "," +
      EMAIL_TO_2,

    subject,

    body,

    options

  );

}


/* ======================================================
   HELPERS
   ====================================================== */

function isValidApiKey_(key) {

  return String(
    key || ""
  ) === String(
    API_KEY
  );

}


function rowToObject_(r) {

  return {

    timestamp:
      formatDateValue_(
        r[0],
        "yyyy-MM-dd HH:mm:ss"
      ),

    ticketNo:
      String(
        r[1] || ""
      ),

    subDivisionCode:
      String(
        r[2] || ""
      ),

    operatorName:
      String(
        r[3] || ""
      ),

    mobileNumber:
      String(
        r[4] || ""
      ),

    date:
      String(
        r[5] || ""
      ),

    issueType:
      String(
        r[6] || ""
      ),

    issue:
      String(
        r[7] || ""
      ),

    securityKey:
      String(
        r[8] || ""
      ),

    status:
      String(
        r[9] || "New"
      ),

    priority:
      String(
        r[10] || "Normal"
      ),

    assignedTo:
      String(
        r[11] || ""
      ),

    lastUpdate:
      formatDateValue_(
        r[12],
        "yyyy-MM-dd HH:mm:ss"
      ),

    resolution:
      String(
        r[13] || ""
      ),

    closedBy:
      String(
        r[14] || ""
      ),

    closedDate:
      formatDateValue_(
        r[15],
        "yyyy-MM-dd"
      ),

    remarks:
      String(
        r[16] || ""
      ),

    snapshotUrl:
      String(
        r[17] || ""
      )

  };

}


function saveSnapshot_(base64Data, mimeType, fileName, ticketNo) {
  if (!base64Data) return "";

  const folder = getSnapshotFolder_();
  const bytes = Utilities.base64Decode(base64Data);

  if (!bytes || !bytes.length) {
    throw new Error("Snapshot image data is empty.");
  }

  // Keep a safe filename and make the ticket number part of the file name.
  let safeName = String(fileName || (ticketNo + ".jpg"))
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim();

  if (!safeName) safeName = ticketNo + ".jpg";

  const blob = Utilities.newBlob(
    bytes,
    mimeType || "image/jpeg",
    safeName
  );

  const file = folder.createFile(blob);

  // The registration/status apps need to open the snapshot without
  // requiring the user's Google Drive login.
  file.setSharing(
    DriveApp.Access.ANYONE_WITH_LINK,
    DriveApp.Permission.VIEW
  );

  return "https://drive.google.com/uc?export=view&id=" + file.getId();
}


function getSnapshotFolder_() {
  const folders = DriveApp.getFoldersByName("Snapshots");
  if (folders.hasNext()) {
    return folders.next();
  }

  return DriveApp.createFolder("Snapshots");
}


function formatDateValue_(
  value,
  pattern
) {

  if (!value) {
    return "";
  }


  if (
    Object.prototype.toString.call(
      value
    ) ===
    "[object Date]"
  ) {

    return Utilities.formatDate(

      value,

      Session.getScriptTimeZone() ||
        "Asia/Karachi",

      pattern

    );

  }


  return String(value);

}


function findLastTicketNumber_(sh) {

  const lastRow =
    sh.getLastRow();


  if (
    lastRow < 2
  ) {

    return 0;

  }


  const values =
    sh.getRange(
      2,
      2,
      lastRow - 1,
      1
    ).getValues();


  let max = 0;


  values.forEach(
    function(v) {

      const m =
        String(
          v[0] || ""
        ).match(
          /-(\d{5})$/
        );


      if (m) {

        max =
          Math.max(
            max,
            Number(
              m[1]
            )
          );

      }

    }
  );


  return max;

}


/* ======================================================
   SECURITY KEY

   Monday    = 210
   Tuesday   = 220
   Wednesday = 230
   Thursday  = 240
   Friday    = 250
   Saturday  = 260
   Sunday    = 270

   Prefix + Reverse Year + Reverse Day + Reverse Month
   ====================================================== */

function generateSecurityKey(d) {

  const prefixes = {

    0: "270",

    1: "210",

    2: "220",

    3: "230",

    4: "240",

    5: "250",

    6: "260"

  };


  const prefix =
    prefixes[
      d.getDay()
    ];


  const tz =
    Session.getScriptTimeZone() ||
    "Asia/Karachi";


  const year =
    Utilities.formatDate(
      d,
      tz,
      "yy"
    );


  const day =
    Utilities.formatDate(
      d,
      tz,
      "dd"
    );


  const month =
    Utilities.formatDate(
      d,
      tz,
      "MM"
    );


  return (

    prefix +

    reverseText(
      year
    ) +

    reverseText(
      day
    ) +

    reverseText(
      month
    )

  );

}


function reverseText(
  value
) {

  return String(value)

    .split("")

    .reverse()

    .join("");

}


function out(x) {

  return ContentService

    .createTextOutput(
      JSON.stringify(x)
    )

    .setMimeType(
      ContentService.MimeType.JSON
    );

}


/* ======================================================
   DATE-RANGE REPORT HELPERS
   ====================================================== */

/** Returns all complaints whose complaint Date is within the inclusive date range. */
function getComplaintReport_(fromDate, toDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    return out({ success: false, message: "Both dates are required in yyyy-MM-dd format." });
  }
  if (fromDate > toDate) {
    return out({ success: false, message: "From Date cannot be later than To Date." });
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) throw new Error("Tickets sheet was not found.");
  ensureHeaders(sh);

  const lastRow = sh.getLastRow();
  const tickets = [];
  const stats = { total: 0, pending: 0, resolved: 0, closed: 0, urgent: 0, high: 0 };
  if (lastRow >= 2) {
    const values = sh.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    values.forEach(function(row) {
      const complaintDate = normalizeReportDate_(row[5]);
      if (!complaintDate || complaintDate < fromDate || complaintDate > toDate) return;
      const item = rowToObject_(row);
      item.date = complaintDate;
      tickets.push(item);
      stats.total++;
      const status = String(item.status || "New").trim().toLowerCase();
      const priority = String(item.priority || "Normal").trim().toLowerCase();
      if (status === "resolved") stats.resolved++;
      else if (status === "closed") stats.closed++;
      else stats.pending++;
      if (priority === "urgent") stats.urgent++;
      if (priority === "high") stats.high++;
    });
  }

  tickets.sort(function(a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return String(b.timestamp || "").localeCompare(String(a.timestamp || ""));
  });
  return out({ success: true, fromDate: fromDate, toDate: toDate, count: tickets.length, stats: stats, tickets: tickets });
}

function normalizeReportDate_(value) {
  if (!value) return "";
  const tz = Session.getScriptTimeZone() || "Asia/Karachi";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, tz, "yyyy-MM-dd");
  }
  const text = String(value).trim();
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[3]).slice(-2);
  m = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (m) {
    // Accept M/d/yyyy (common sheet display) and d-M-yyyy when day is unambiguous.
    let month = Number(m[1]), day = Number(m[2]);
    const year = Number(m[3]);
    if (month > 12 && day >= 1 && day <= 12) { const swap = month; month = day; day = swap; }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return year + "-" + ("0" + month).slice(-2) + "-" + ("0" + day).slice(-2);
    }
  }
  return "";
}
