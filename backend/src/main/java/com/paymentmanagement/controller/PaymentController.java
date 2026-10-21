package com.paymentmanagement.controller;

import com.paymentmanagement.dto.request.CreatePaymentRequest;
import com.paymentmanagement.dto.response.PaymentResponse;
import com.paymentmanagement.service.PaymentService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@Validated
public class PaymentController {

    private final PaymentService service;

    public PaymentController(PaymentService service) {
        this.service = service;
    }

    @PostMapping("/api/payments")
    @ResponseStatus(HttpStatus.CREATED)
    public PaymentResponse create(@Valid @RequestBody CreatePaymentRequest request) {
        return service.create(request);
    }

    @GetMapping("/api/students/{studentId}/payments")
    public List<PaymentResponse> history(@PathVariable @Positive long studentId) {
        return service.history(studentId);
    }
}
