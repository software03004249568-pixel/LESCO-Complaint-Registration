package com.lesco.supportregistration

import android.Manifest
import android.app.DatePickerDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.view.View
import android.widget.ArrayAdapter
import android.widget.AutoCompleteTextView
import android.widget.Button
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.exifinterface.media.ExifInterface
import com.google.android.material.card.MaterialCardView
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import org.json.JSONObject
import java.io.BufferedReader
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

    companion object {
        private const val API_URL = "https://script.google.com/macros/s/AKfycbwi_y-MAgmn_5YBOapbcP1iwyShWGdaPYlZ2hH1cgVJzYy2X7-n5FNwBn29dp-USWnQ/exec"
        private const val API_KEY = "LESCO_IT_2026_9X7K2P5M8Q7A4"
        private const val MAX_IMAGE_DIMENSION = 1280
        private const val MAX_IMAGE_BYTES = 500 * 1024
    }

    private lateinit var subDivisionEdit: TextInputEditText
    private lateinit var operatorEdit: TextInputEditText
    private lateinit var mobileEdit: TextInputEditText
    private lateinit var dateEdit: TextInputEditText
    private lateinit var issueTypeDropdown: AutoCompleteTextView
    private lateinit var issueEdit: TextInputEditText
    private lateinit var dateLayout: TextInputLayout
    private lateinit var submitButton: Button
    private lateinit var newComplaintButton: Button
    private lateinit var progressBar: ProgressBar
    private lateinit var successCard: MaterialCardView
    private lateinit var ticketText: TextView
    private lateinit var securityText: TextView
    private lateinit var statusText: TextView
    private lateinit var snapshotInfo: TextView
    private lateinit var snapshotUploadInfo: TextView
    private lateinit var retrySnapshotButton: Button
    private lateinit var snapshotPreview: ImageView
    private lateinit var statusTicketEdit: TextInputEditText
    private lateinit var checkStatusButton: Button
    private lateinit var statusResultCard: MaterialCardView
    private lateinit var statusResultText: TextView
    private lateinit var statusSnapshotButton: Button

    private val executor = Executors.newSingleThreadExecutor()
    private val calendar = Calendar.getInstance()
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    private val issueTypes = listOf(
        "Snap Uploading",
        "Level 1 Installation",
        "Level 1 Application",
        "Mobile Meter Reading",
        "Others"
    )

    private var selectedImageUri: Uri? = null
    private var cameraImageUri: Uri? = null
    private var lastTicketForSnapshot: String? = null
    private var lastSnapshotUrl: String? = null

    private val galleryLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) setSelectedImage(uri)
    }

    private val cameraLauncher = registerForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success ->
        if (success && cameraImageUri != null) {
            setSelectedImage(cameraImageUri!!)
        } else {
            cameraImageUri = null
        }
    }

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) launchCamera() else {
            Toast.makeText(this, "Camera permission is required to take a snapshot.", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        bindViews()
        dateEdit.setText(dateFormat.format(calendar.time))

        val adapter = ArrayAdapter(this, android.R.layout.simple_dropdown_item_1line, issueTypes)
        issueTypeDropdown.setAdapter(adapter)
        issueTypeDropdown.setOnClickListener { issueTypeDropdown.showDropDown() }

        dateEdit.setOnClickListener { showDatePicker() }
        dateLayout.setEndIconOnClickListener { showDatePicker() }
        submitButton.setOnClickListener { submitComplaint() }
        newComplaintButton.setOnClickListener { resetForm() }
        findViewById<Button>(R.id.snapshotButton).setOnClickListener { showSnapshotOptions() }
        findViewById<Button>(R.id.removeSnapshotButton).setOnClickListener { clearSelectedImage() }
        retrySnapshotButton.setOnClickListener { retrySnapshotUpload() }
        checkStatusButton.setOnClickListener { checkComplaintStatus() }
        statusSnapshotButton.setOnClickListener { openSnapshot() }
    }

    private fun bindViews() {
        subDivisionEdit = findViewById(R.id.subDivisionEdit)
        operatorEdit = findViewById(R.id.operatorEdit)
        mobileEdit = findViewById(R.id.mobileEdit)
        dateEdit = findViewById(R.id.dateEdit)
        dateLayout = findViewById(R.id.dateLayout)
        issueTypeDropdown = findViewById(R.id.issueTypeDropdown)
        issueEdit = findViewById(R.id.issueEdit)
        submitButton = findViewById(R.id.submitButton)
        newComplaintButton = findViewById(R.id.newComplaintButton)
        progressBar = findViewById(R.id.progressBar)
        successCard = findViewById(R.id.successCard)
        ticketText = findViewById(R.id.ticketText)
        securityText = findViewById(R.id.securityText)
        statusText = findViewById(R.id.statusText)
        snapshotInfo = findViewById(R.id.snapshotInfo)
        snapshotUploadInfo = findViewById(R.id.snapshotUploadInfo)
        retrySnapshotButton = findViewById(R.id.retrySnapshotButton)
        snapshotPreview = findViewById(R.id.snapshotPreview)
        statusTicketEdit = findViewById(R.id.statusTicketEdit)
        checkStatusButton = findViewById(R.id.checkStatusButton)
        statusResultCard = findViewById(R.id.statusResultCard)
        statusResultText = findViewById(R.id.statusResultText)
        statusSnapshotButton = findViewById(R.id.statusSnapshotButton)
    }

    private fun showDatePicker() {
        DatePickerDialog(
            this,
            { _, year, month, day ->
                calendar.set(year, month, day)
                dateEdit.setText(dateFormat.format(calendar.time))
            },
            calendar.get(Calendar.YEAR),
            calendar.get(Calendar.MONTH),
            calendar.get(Calendar.DAY_OF_MONTH)
        ).show()
    }

    private fun showSnapshotOptions() {
        AlertDialog.Builder(this)
            .setTitle("Add Complaint Snapshot")
            .setItems(arrayOf("Take Photo with Camera", "Choose from Gallery")) { _, which ->
                if (which == 0) requestCamera() else galleryLauncher.launch("image/*")
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun requestCamera() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            launchCamera()
        } else {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun launchCamera() {
        val imageFile = File.createTempFile("lesco_snapshot_", ".jpg", cacheDir)
        cameraImageUri = FileProvider.getUriForFile(
            this,
            "${BuildConfig.APPLICATION_ID}.fileprovider",
            imageFile
        )
        cameraLauncher.launch(cameraImageUri)
    }

    private fun setSelectedImage(uri: Uri) {
        selectedImageUri = uri
        snapshotPreview.setImageURI(uri)
        snapshotPreview.visibility = View.VISIBLE
        findViewById<Button>(R.id.removeSnapshotButton).visibility = View.VISIBLE
        snapshotInfo.text = "Snapshot selected. It will be resized, compressed and stamped with the Ticket No before upload."
    }

    private fun clearSelectedImage() {
        selectedImageUri = null
        cameraImageUri = null
        snapshotPreview.setImageDrawable(null)
        snapshotPreview.visibility = View.GONE
        findViewById<Button>(R.id.removeSnapshotButton).visibility = View.GONE
        snapshotInfo.text = "Optional: add one snapshot from Camera or Gallery."
    }

    private fun submitComplaint() {
        val subDivision = subDivisionEdit.text?.toString()?.trim().orEmpty()
        val operator = operatorEdit.text?.toString()?.trim().orEmpty()
        val mobile = mobileEdit.text?.toString()?.trim().orEmpty()
        val date = dateEdit.text?.toString()?.trim().orEmpty()
        val issueType = issueTypeDropdown.text?.toString()?.trim().orEmpty()
        val issue = issueEdit.text?.toString()?.trim().orEmpty()

        if (!validate(subDivision, operator, mobile, date, issueType, issue)) return

        setBusy(true)
        successCard.visibility = View.GONE
        retrySnapshotButton.visibility = View.GONE
        lastTicketForSnapshot = null
        lastSnapshotUrl = null

        executor.execute {
            try {
                val params = linkedMapOf(
                    "action" to "create",
                    "subDivisionCode" to subDivision,
                    "operatorName" to operator,
                    "mobileNo" to mobile,
                    "issueDate" to date,
                    "issueType" to issueType,
                    "issue" to issue
                )
                val response = postForm(params)
                val json = JSONObject(response)

                if (!json.optBoolean("success", false)) {
                    runOnUiThread {
                        setBusy(false)
                        Toast.makeText(this, json.optString("message", "Complaint could not be registered"), Toast.LENGTH_LONG).show()
                    }
                    return@execute
                }

                val ticket = json.optString("ticketNo", "-")
                val securityKey = json.optString("securityKey", "").trim()
                val status = json.optString("status", "New")
                lastTicketForSnapshot = ticket

                var snapshotMessage = "No snapshot attached."
                var uploadedUrl = ""

                if (selectedImageUri != null && ticket.isNotBlank() && ticket != "-") {
                    try {
                        val bytes = prepareSnapshotBytes(selectedImageUri!!, ticket)
                        val base64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
                        val snapshotParams = linkedMapOf(
                            "action" to "attachSnapshot",
                            "key" to API_KEY,
                            "ticketNo" to ticket,
                            "snapshotBase64" to base64,
                            "snapshotMime" to "image/jpeg",
                            "snapshotName" to "$ticket.jpg"
                        )
                        val snapshotResponse = postForm(snapshotParams)
                        val snapshotJson = JSONObject(snapshotResponse)
                        if (snapshotJson.optBoolean("success", false)) {
                            uploadedUrl = snapshotJson.optString("snapshotUrl", "")
                            lastSnapshotUrl = uploadedUrl
                            snapshotMessage = "Snapshot uploaded successfully."
                        } else {
                            snapshotMessage = "Snapshot upload failed: ${snapshotJson.optString("message", "Please retry.")}"
                        }
                    } catch (ex: Exception) {
                        snapshotMessage = "Snapshot upload failed: ${ex.message ?: "Please retry."}"
                    }
                }

                runOnUiThread {
                    setBusy(false)
                    ticketText.text = "Ticket No: $ticket"
                    securityText.text = if (securityKey.isNotEmpty()) {
                        "Security Key: $securityKey"
                    } else {
                        "Security Key: Not required"
                    }
                    statusText.text = "Status: $status"
                    snapshotUploadInfo.text = snapshotMessage
                    retrySnapshotButton.visibility = if (selectedImageUri != null && uploadedUrl.isEmpty()) View.VISIBLE else View.GONE
                    successCard.visibility = View.VISIBLE
                    Toast.makeText(this, "Complaint registered successfully", Toast.LENGTH_LONG).show()
                }
            } catch (ex: Exception) {
                runOnUiThread {
                    setBusy(false)
                    Toast.makeText(this, "Network/Server error: ${ex.message ?: "Please try again"}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun retrySnapshotUpload() {
        val uri = selectedImageUri ?: return
        val ticket = lastTicketForSnapshot ?: return
        setBusy(true)
        executor.execute {
            try {
                val bytes = prepareSnapshotBytes(uri, ticket)
                val base64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
                val params = linkedMapOf(
                    "action" to "attachSnapshot",
                    "key" to API_KEY,
                    "ticketNo" to ticket,
                    "snapshotBase64" to base64,
                    "snapshotMime" to "image/jpeg",
                    "snapshotName" to "$ticket.jpg"
                )
                val json = JSONObject(postForm(params))
                runOnUiThread {
                    setBusy(false)
                    if (json.optBoolean("success", false)) {
                        lastSnapshotUrl = json.optString("snapshotUrl", "")
                        snapshotUploadInfo.text = "Snapshot uploaded successfully."
                        retrySnapshotButton.visibility = View.GONE
                    } else {
                        snapshotUploadInfo.text = "Snapshot upload failed: ${json.optString("message", "Please try again.")}"
                    }
                }
            } catch (ex: Exception) {
                runOnUiThread {
                    setBusy(false)
                    snapshotUploadInfo.text = "Snapshot upload failed: ${ex.message ?: "Please try again."}"
                }
            }
        }
    }

    private fun prepareSnapshotBytes(uri: Uri, ticketNo: String): ByteArray {
        val bitmap = loadScaledBitmap(uri, MAX_IMAGE_DIMENSION)
            ?: throw IllegalStateException("Unable to read selected image")

        val rotated = rotateAccordingToExif(bitmap, uri)
        val stamped = stampTicket(rotated, ticketNo)

        val qualities = intArrayOf(72, 62, 52, 42)
        var output = ByteArrayOutputStream()
        for (quality in qualities) {
            output = ByteArrayOutputStream()
            if (!stamped.compress(Bitmap.CompressFormat.JPEG, quality, output)) {
                throw IllegalStateException("Unable to compress snapshot")
            }
            if (output.size() <= MAX_IMAGE_BYTES || quality == qualities.last()) break
        }

        if (stamped !== rotated) stamped.recycle()
        if (rotated !== bitmap) rotated.recycle()
        bitmap.recycle()
        return output.toByteArray()
    }

    private fun loadScaledBitmap(uri: Uri, maxDimension: Int): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

        var sample = 1
        while (bounds.outWidth / sample > maxDimension * 2 || bounds.outHeight / sample > maxDimension * 2) {
            sample *= 2
        }

        val options = BitmapFactory.Options().apply { inSampleSize = sample; inPreferredConfig = Bitmap.Config.ARGB_8888 }
        val bitmap = contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) }
            ?: return null

        val scale = minOf(1f, maxDimension.toFloat() / maxOf(bitmap.width, bitmap.height).toFloat())
        if (scale >= 1f) return bitmap
        val width = (bitmap.width * scale).toInt().coerceAtLeast(1)
        val height = (bitmap.height * scale).toInt().coerceAtLeast(1)
        val scaled = Bitmap.createScaledBitmap(bitmap, width, height, true)
        if (scaled !== bitmap) bitmap.recycle()
        return scaled
    }

    private fun rotateAccordingToExif(bitmap: Bitmap, uri: Uri): Bitmap {
        return try {
            contentResolver.openInputStream(uri)?.use { stream ->
                val exif = ExifInterface(stream)
                when (exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                    ExifInterface.ORIENTATION_ROTATE_90 -> rotateBitmap(bitmap, 90f)
                    ExifInterface.ORIENTATION_ROTATE_180 -> rotateBitmap(bitmap, 180f)
                    ExifInterface.ORIENTATION_ROTATE_270 -> rotateBitmap(bitmap, 270f)
                    else -> bitmap
                }
            } ?: bitmap
        } catch (_: Exception) {
            bitmap
        }
    }

    private fun rotateBitmap(source: Bitmap, degrees: Float): Bitmap {
        val matrix = android.graphics.Matrix().apply { postRotate(degrees) }
        return Bitmap.createBitmap(source, 0, 0, source.width, source.height, matrix, true)
    }

    private fun stampTicket(bitmap: Bitmap, ticketNo: String): Bitmap {
        val mutable = if (bitmap.config == Bitmap.Config.ARGB_8888) bitmap.copy(Bitmap.Config.ARGB_8888, true)
        else bitmap.copy(Bitmap.Config.ARGB_8888, true)

        val canvas = Canvas(mutable)
        val textSize = (mutable.width * 0.034f).coerceIn(28f, 48f)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            this.textSize = textSize
            typeface = android.graphics.Typeface.create(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD)
        }
        val text = ticketNo
        val padding = textSize * 0.45f
        val textWidth = paint.measureText(text)
        val boxWidth = textWidth + padding * 2
        val boxHeight = textSize + padding * 2
        val left = mutable.width - boxWidth - padding
        val top = padding
        val rect = RectF(left, top, mutable.width - padding, top + boxHeight)

        val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(205, 13, 71, 161) }
        canvas.drawRoundRect(rect, padding * 0.6f, padding * 0.6f, bgPaint)
        canvas.drawText(text, rect.left + padding, rect.bottom - padding * 0.8f, paint)
        return mutable
    }

    private fun checkComplaintStatus() {
        val ticket = statusTicketEdit.text?.toString()?.trim().orEmpty()
        if (ticket.isBlank()) {
            statusTicketEdit.error = "Enter Ticket No"
            statusTicketEdit.requestFocus()
            return
        }

        checkStatusButton.isEnabled = false
        checkStatusButton.text = "Checking..."
        statusResultCard.visibility = View.GONE

        executor.execute {
            try {
                val url = API_URL + "?action=ticket&key=" + URLEncoder.encode(API_KEY, "UTF-8") +
                    "&ticketNo=" + URLEncoder.encode(ticket, "UTF-8")
                val json = JSONObject(getUrl(url))
                runOnUiThread {
                    checkStatusButton.isEnabled = true
                    checkStatusButton.text = "Check Status"
                    if (json.optBoolean("success", false)) {
                        val item = json.optJSONObject("ticket") ?: JSONObject()
                        val rawStatus = item.optString("status", "New")
                        val displayStatus = if (rawStatus.equals("Resolved", true) || rawStatus.equals("Closed", true)) "Resolved" else "Pending"
                        val resolution = item.optString("resolution", "").trim()
                        val issueType = item.optString("issueType", "")
                        val issue = item.optString("issue", "")
                        val snapshotUrl = item.optString("snapshotUrl", "").trim()
                        lastSnapshotUrl = snapshotUrl

                        statusResultText.text = buildString {
                            append("Ticket No: ").append(item.optString("ticketNo", ticket)).append("\n")
                            append("Status: ").append(displayStatus).append("\n")
                            append("Issue Type: ").append(issueType).append("\n")
                            append("Issue: ").append(issue)
                            if (resolution.isNotEmpty()) append("\nResolution: ").append(resolution)
                        }
                        statusSnapshotButton.visibility = if (snapshotUrl.isNotEmpty()) View.VISIBLE else View.GONE
                        statusResultCard.visibility = View.VISIBLE
                    } else {
                        Toast.makeText(this, json.optString("message", "Ticket not found"), Toast.LENGTH_LONG).show()
                    }
                }
            } catch (ex: Exception) {
                runOnUiThread {
                    checkStatusButton.isEnabled = true
                    checkStatusButton.text = "Check Status"
                    Toast.makeText(this, "Network/Server error: ${ex.message ?: "Please try again"}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun openSnapshot() {
        val url = lastSnapshotUrl.orEmpty()
        if (url.isBlank()) return
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    }

    private fun validate(
        subDivision: String,
        operator: String,
        mobile: String,
        date: String,
        issueType: String,
        issue: String
    ): Boolean {
        if (!Regex("^\\d{5}$").matches(subDivision)) {
            subDivisionEdit.error = "Enter exactly 5 digits"
            subDivisionEdit.requestFocus()
            return false
        }
        if (operator.isBlank()) {
            operatorEdit.error = "Operator name is required"
            operatorEdit.requestFocus()
            return false
        }
        if (!Regex("^\\d{11}$").matches(mobile)) {
            mobileEdit.error = "Enter exactly 11 digits"
            mobileEdit.requestFocus()
            return false
        }
        if (date.isBlank()) {
            dateEdit.error = "Select complaint date"
            return false
        }
        if (issueType.isBlank()) {
            issueTypeDropdown.error = "Select issue type"
            issueTypeDropdown.requestFocus()
            return false
        }
        if (issue.isBlank()) {
            issueEdit.error = "Describe the problem"
            issueEdit.requestFocus()
            return false
        }
        return true
    }

    private fun setBusy(busy: Boolean) {
        submitButton.isEnabled = !busy
        findViewById<Button>(R.id.snapshotButton).isEnabled = !busy
        checkStatusButton.isEnabled = !busy
        progressBar.visibility = if (busy) View.VISIBLE else View.GONE
        submitButton.text = if (busy) "Submitting..." else "Submit Complaint"
    }

    private fun resetForm() {
        subDivisionEdit.text?.clear()
        operatorEdit.text?.clear()
        mobileEdit.text?.clear()
        issueTypeDropdown.setText("", false)
        issueEdit.text?.clear()
        calendar.timeInMillis = System.currentTimeMillis()
        dateEdit.setText(dateFormat.format(calendar.time))
        successCard.visibility = View.GONE
        retrySnapshotButton.visibility = View.GONE
        clearSelectedImage()
        lastTicketForSnapshot = null
        lastSnapshotUrl = null
        subDivisionEdit.requestFocus()
    }

    private fun postForm(params: Map<String, String>): String {
        val body = params.entries.joinToString("&") {
            "${URLEncoder.encode(it.key, "UTF-8")}=${URLEncoder.encode(it.value, "UTF-8")}"
        }

        val connection = (URL(API_URL).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 20000
            readTimeout = 60000
            doOutput = true
            setRequestProperty("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
            setRequestProperty("Accept", "application/json")
        }

        return try {
            connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val stream = if (connection.responseCode in 200..399) connection.inputStream else connection.errorStream
            BufferedReader(InputStreamReader(stream, Charsets.UTF_8)).use { it.readText() }
        } finally {
            connection.disconnect()
        }
    }

    private fun getUrl(urlString: String): String {
        val connection = (URL(urlString).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 20000
            readTimeout = 30000
            setRequestProperty("Accept", "application/json")
        }
        return try {
            val stream = if (connection.responseCode in 200..399) connection.inputStream else connection.errorStream
            BufferedReader(InputStreamReader(stream, Charsets.UTF_8)).use { it.readText() }
        } finally {
            connection.disconnect()
        }
    }

    override fun onDestroy() {
        executor.shutdownNow()
        super.onDestroy()
    }
}
