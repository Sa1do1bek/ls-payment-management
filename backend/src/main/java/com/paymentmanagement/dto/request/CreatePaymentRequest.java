package com.paymentmanagement.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.time.LocalDate;

public record CreatePaymentRequest(
        @NotNull(message = "studentId is required")
        @Positive(message = "studentId must be positive")
        Long studentId,
        @NotNull(message = "amount is required")
        @Positive(message = "amount must be positive")
        Long amount,
        @NotNull(message = "paymentDate is required")
        LocalDate paymentDate) {
}
