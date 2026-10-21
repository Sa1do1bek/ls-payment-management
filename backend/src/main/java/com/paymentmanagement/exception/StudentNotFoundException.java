package com.paymentmanagement.exception;

public class StudentNotFoundException extends RuntimeException {

    public StudentNotFoundException(long id) {
        super("Student with ID " + id + " was not found");
    }
}
