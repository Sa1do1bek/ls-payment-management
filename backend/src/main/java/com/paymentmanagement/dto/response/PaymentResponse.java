package com.paymentmanagement.dto.response;

import java.time.LocalDate;

public record PaymentResponse(Long id, Long studentId, Long amount, LocalDate paymentDate) {
}
