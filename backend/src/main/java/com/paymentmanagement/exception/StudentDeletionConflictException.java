package com.paymentmanagement.exception;

public class StudentDeletionConflictException extends RuntimeException {

    public StudentDeletionConflictException(long id) {
        super("Student with ID " + id + " cannot be deleted because payment history exists");
    }

    public StudentDeletionConflictException(long id, Throwable cause) {
        super("Student with ID " + id + " cannot be deleted because payment history exists", cause);
    }
}
