package com.paymentmanagement.dto.response;

import java.math.BigInteger;

public record DebtorResponse(Long studentId, String name, String phone, String groupName,
                             Long monthlyFee, BigInteger paidAmount, Long debt) {
}
