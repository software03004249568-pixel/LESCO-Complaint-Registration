package com.lesco.supportregistration

import android.app.DatePickerDialog
import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import android.widget.AutoCompleteTextView
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.card.MaterialCardView
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import org.json.JSONObject
import java.io.BufferedReader
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

    private val executor = Executors.newSingleThreadExecutor()
    private val calendar = Calendar.getInstance()
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    // Keep the known backend value exactly as used by the existing system.
    // Other common categories are provided for mobile users; they are sent as plain text.
    private val issueTypes = listOf(
        "Snap Uploading",
        "Level 1 Installation",
        "Level 1 Application",
        "Mobile Meter Reading",
        "Others"
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

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

        dateEdit.setText(dateFormat.format(calendar.time))

        val adapter = ArrayAdapter(this, android.R.layout.simple_dropdown_item_1line, issueTypes)
        issueTypeDropdown.setAdapter(adapter)
        issueTypeDropdown.setOnClickListener { issueTypeDropdown.showDropDown() }
        issueTypeDropdown.setOnItemClickListener { _, _, _, _ -> }

        dateEdit.setOnClickListener { showDatePicker() }
        dateLayout.setEndIconOnClickListener { showDatePicker() }
        submitButton.setOnClickListener { submitComplaint() }
        newComplaintButton.setOnClickListener { resetForm() }
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

        executor.execute {
            try {
                val params = linkedMapOf(
                    "subDivisionCode" to subDivision,
                    "operatorName" to operator,
                    "mobileNo" to mobile,
                    "issueDate" to date,
                    "issueType" to issueType,
                    "issue" to issue
                )
                val response = postForm(params)
                val json = JSONObject(response)

                runOnUiThread {
                    setBusy(false)
                    if (json.optBoolean("success", false)) {
                        ticketText.text = "Ticket No: ${json.optString("ticketNo", "-")}"
                        val securityKey = json.optString("securityKey", "").trim()
                        securityText.text = if (securityKey.isNotEmpty()) {
                            "Security Key: $securityKey"
                        } else {
                            "Security Key: Not required"
                        }
                        statusText.text = "Status: ${json.optString("status", "New")}"
                        successCard.visibility = View.VISIBLE
                        Toast.makeText(this, "Complaint registered successfully", Toast.LENGTH_LONG).show()
                    } else {
                        Toast.makeText(this, json.optString("message", "Complaint could not be registered"), Toast.LENGTH_LONG).show()
                    }
                }
            } catch (ex: Exception) {
                runOnUiThread {
                    setBusy(false)
                    Toast.makeText(this, "Network/Server error: ${ex.message ?: "Please try again"}", Toast.LENGTH_LONG).show()
                }
            }
        }
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
        subDivisionEdit.requestFocus()
    }

    private fun postForm(params: Map<String, String>): String {
        val body = params.entries.joinToString("&") {
            "${URLEncoder.encode(it.key, "UTF-8")}=${URLEncoder.encode(it.value, "UTF-8")}"
        }

        val connection = (URL(API_URL).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 20000
            readTimeout = 30000
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

    override fun onDestroy() {
        executor.shutdownNow()
        super.onDestroy()
    }
}
