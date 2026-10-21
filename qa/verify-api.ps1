# Run from the repository root with PostgreSQL and Spring Boot already running.
# Creates only uniquely named disposable records and removes their exact IDs.
param([string]$BaseUrl = 'http://localhost:8080')

$ErrorActionPreference = 'Stop'
$createdStudents = [System.Collections.Generic.List[long]]::new()
$createdPayments = [System.Collections.Generic.List[long]]::new()
$databaseName = if ($env:DB_NAME) { $env:DB_NAME } else { 'payment_management' }
$databaseUser = if ($env:DB_USERNAME) { $env:DB_USERNAME } else { 'payment_user' }
$runName = 'QA-' + [guid]::NewGuid().ToString('N').Substring(0, 12)
$checks = 0

function Check([bool]$condition, [string]$description) {
    if (-not $condition) { throw "FAILED: $description" }
    $script:checks++
    Write-Host "PASS: $description"
}

function Api([string]$method, [string]$path, $body = $null) {
    $arguments = @{ Method = $method; Uri = "$BaseUrl$path"; SkipHttpErrorCheck = $true }
    if ($null -ne $body) {
        $arguments.ContentType = 'application/json'
        $arguments.Body = ConvertTo-Json -InputObject $body -Compress
    }
    $response = Invoke-WebRequest @arguments
    $data = if ($response.Content) { ConvertFrom-Json -InputObject $response.Content } else { $null }
    return @{ Status = [int]$response.StatusCode; Data = $data; Text = $response.Content; Headers = $response.Headers }
}

function New-Student([string]$suffix, [long]$fee) {
    $result = Api 'POST' '/api/students' @{
        name = "$runName $suffix"; phone = '+998901234567'; groupName = 'QA'; monthlyFee = $fee
    }
    Check ($result.Status -eq 201 -and $result.Data.id -gt 0) "POST student $suffix returns 201"
    $createdStudents.Add([long]$result.Data.id)
    return $result.Data
}

function New-Payment([long]$studentId, [long]$amount, [string]$date) {
    $result = Api 'POST' '/api/payments' @{
        studentId = $studentId; amount = $amount; paymentDate = $date
    }
    Check ($result.Status -eq 201 -and $result.Data.id -gt 0) "POST payment $date returns 201"
    $createdPayments.Add([long]$result.Data.id)
    return $result.Data
}

try {
    Check ((Api 'GET' '/api/health').Status -eq 200) 'health returns 200'
    $initialStudents = Api 'GET' '/api/students'
    Check ($initialStudents.Status -eq 200 -and $initialStudents.Text.StartsWith('[')) 'student list returns JSON'
    if ($initialStudents.Text -eq '[]') {
        Check ((Api 'GET' '/api/debtors?month=2026-10').Text -eq '[]') 'no students yields empty debtors'
    } else {
        Write-Output 'SKIP: no-students scenario; database already contains unrelated students'
    }

    $unpaid = New-Student 'Unpaid' 800000
    $partial = New-Student 'Partial' 800000
    $full = New-Student 'Full' 500000
    $over = New-Student 'Over' 300000
    $boundary = New-Student 'Boundary' 600000
    $crud = New-Student 'CRUD' 450000

    $fetched = Api 'GET' "/api/students/$($crud.id)"
    Check ($fetched.Status -eq 200 -and $fetched.Data.name -eq "$runName CRUD") 'GET student persists created record'
    $list = Api 'GET' '/api/students'
    Check ($list.Status -eq 200 -and @($list.Data | Where-Object id -eq $crud.id).Count -eq 1) 'GET students includes created record'
    $updated = Api 'PUT' "/api/students/$($crud.id)" @{
        name = "$runName Updated"; phone = '+998901234567'; groupName = 'QA'; monthlyFee = 460000
    }
    Check ($updated.Status -eq 200 -and $updated.Data.monthlyFee -eq 460000) 'PUT student persists update'
    Check ((Api 'GET' "/api/students/$($crud.id)").Data.name -eq "$runName Updated") 'GET student sees updated record'
    Check ((Api 'DELETE' "/api/students/$($crud.id)").Status -eq 204) 'DELETE student without payments returns 204'
    $createdStudents.Remove([long]$crud.id) | Out-Null
    Check ((Api 'GET' "/api/students/$($crud.id)").Status -eq 404) 'deleted student returns 404'

    $oct1 = New-Payment $partial.id 200000 '2026-10-05'
    $oct2 = New-Payment $partial.id 300000 '2026-10-05'
    $sep = New-Payment $partial.id 50000 '2026-09-30'
    $null = New-Payment $full.id 500000 '2026-10-21'
    $null = New-Payment $over.id 400000 '2026-10-21'
    $null = New-Payment $boundary.id 100000 '2026-12-31'
    $null = New-Payment $boundary.id 200000 '2027-01-01'
    $null = New-Payment $boundary.id 150000 '2024-02-29'

    $history = Api 'GET' "/api/students/$($partial.id)/payments"
    Check ($history.Status -eq 200 -and @($history.Data).Count -eq 3) 'history retains three independent records'
    Check ($history.Data[0].id -eq $oct2.id -and $history.Data[1].id -eq $oct1.id -and
           $history.Data[2].id -eq $sep.id) 'history sorts by date, then descending ID'
    Check ((Api 'DELETE' "/api/students/$($partial.id)").Status -eq 409) 'student deletion with payments returns 409'
    Check ((Api 'GET' "/api/students/$($partial.id)").Status -eq 200) '409 leaves student intact'

    $oct = Api 'GET' '/api/debtors?month=2026-10'
    $alias = Api 'GET' '/debtors?month=2026-10'
    Check ($oct.Status -eq 200 -and $alias.Status -eq 200 -and $oct.Text -eq $alias.Text) 'both debtor routes return identical JSON'
    $partialRow = @($oct.Data | Where-Object studentId -eq $partial.id)
    Check ($partialRow.Count -eq 1 -and $partialRow[0].paidAmount -eq 500000 -and $partialRow[0].debt -eq 300000) 'multiple partial payments sum in October'
    Check (@($oct.Data | Where-Object studentId -eq $unpaid.id).Count -eq 1) 'no payment owes full fee'
    Check (@($oct.Data | Where-Object studentId -eq $full.id).Count -eq 0) 'fully paid student excluded'
    Check (@($oct.Data | Where-Object studentId -eq $over.id).Count -eq 0) 'overpaid student excluded'
    Check (@($oct.Data | Where-Object studentId -eq $boundary.id)[0].debt -eq 600000) 'payments from another month do not reduce October debt'
    Check (@($oct.Data | Measure-Object -Property debt -Sum).Sum -eq 1700000) 'October debt total is 1,700,000 UZS'

    $dec = Api 'GET' '/api/debtors?month=2026-12'
    $jan = Api 'GET' '/api/debtors?month=2027-01'
    $feb = Api 'GET' '/api/debtors?month=2024-02'
    Check (@($dec.Data | Where-Object studentId -eq $boundary.id)[0].debt -eq 500000) 'December payment stays in December'
    Check (@($jan.Data | Where-Object studentId -eq $boundary.id)[0].debt -eq 400000) 'January payment crosses year boundary correctly'
    Check (@($feb.Data | Where-Object studentId -eq $boundary.id)[0].debt -eq 450000) 'February 29 payment counts in leap year'

    $invalidMonth = Api 'GET' '/api/debtors?month=2026-13'
    Check ($invalidMonth.Status -eq 400 -and $invalidMonth.Data.status -eq 400) 'invalid month returns JSON 400'
    Check ((Api 'GET' '/debtors').Status -eq 400) 'missing month returns 400'
    Check ((Api 'POST' '/api/payments' @{ studentId = $partial.id; amount = 0; paymentDate = '2026-10-21' }).Status -eq 400) 'zero payment returns 400'
    Check ((Api 'POST' '/api/payments' @{ studentId = 9223372036854775807; amount = 1; paymentDate = '2026-10-21' }).Status -eq 404) 'missing payment student returns 404'
    Check ((Api 'POST' '/api/students' @{ name = ''; phone = '+998901234567'; groupName = 'QA'; monthlyFee = 100 }).Status -eq 400) 'invalid student returns 400'
    Write-Output "API verification passed: $checks assertions."
} finally {
    if ($createdPayments.Count -gt 0) {
        $ids = ($createdPayments | ForEach-Object { [string]$_ }) -join ','
        $sql = "DELETE FROM payments WHERE id IN ($ids);"
        docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U $databaseUser -d $databaseName -c $sql
        if ($LASTEXITCODE -ne 0) { throw 'Cleanup failed while deleting disposable payments' }
    }
    foreach ($studentId in $createdStudents) {
        $result = Api 'DELETE' "/api/students/$studentId"
        if ($result.Status -ne 204) { throw "Cleanup failed for disposable student $studentId" }
    }
    Write-Output 'Disposable API verification records removed.'
}
