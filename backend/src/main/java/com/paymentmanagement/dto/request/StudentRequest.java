package com.paymentmanagement.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record StudentRequest(
        @NotBlank(message = "name is required")
        @Size(max = 150, message = "name must be at most 150 characters")
        String name,
        @NotBlank(message = "phone is required")
        @Size(max = 30, message = "phone must be at most 30 characters")
        String phone,
        @NotBlank(message = "groupName is required")
        @Size(max = 100, message = "groupName must be at most 100 characters")
        String groupName,
        @NotNull(message = "monthlyFee is required")
        @Positive(message = "monthlyFee must be positive")
        Long monthlyFee) {
}
