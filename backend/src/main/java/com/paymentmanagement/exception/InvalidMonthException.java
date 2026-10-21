package com.paymentmanagement.exception;

public class InvalidMonthException extends RuntimeException {

    public InvalidMonthException() {
        super("month must use YYYY-MM format");
    }
}
