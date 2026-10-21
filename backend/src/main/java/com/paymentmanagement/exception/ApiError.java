package com.paymentmanagement.exception;

public record ApiError(int status, String error, String message, String path) {
}
