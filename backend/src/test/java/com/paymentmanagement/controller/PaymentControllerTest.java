package com.paymentmanagement.controller;

import com.paymentmanagement.dto.request.CreatePaymentRequest;
import com.paymentmanagement.dto.response.PaymentResponse;
import com.paymentmanagement.exception.StudentNotFoundException;
import com.paymentmanagement.service.PaymentService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PaymentController.class)
class PaymentControllerTest {

    private static final String VALID_JSON = """
            {"studentId":7,"amount":300000,"paymentDate":"2026-10-21"}
            """;

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private PaymentService service;

    @Test
    void createReturns201WithIsoDate() throws Exception {
        when(service.create(any(CreatePaymentRequest.class)))
                .thenReturn(new PaymentResponse(11L, 7L, 300000L, LocalDate.of(2026, 10, 21)));

        mvc.perform(post("/api/payments").contentType(MediaType.APPLICATION_JSON).content(VALID_JSON))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(11))
                .andExpect(jsonPath("$.studentId").value(7))
                .andExpect(jsonPath("$.amount").value(300000))
                .andExpect(jsonPath("$.paymentDate").value("2026-10-21"));
    }

    @Test
    void createForMissingStudentReturns404() throws Exception {
        when(service.create(any(CreatePaymentRequest.class))).thenThrow(new StudentNotFoundException(7L));

        mvc.perform(post("/api/payments").contentType(MediaType.APPLICATION_JSON).content(VALID_JSON))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Student with ID 7 was not found"));
    }

    @Test
    void missingStudentIdReturns400() throws Exception {
        assertInvalid(VALID_JSON.replace("\"studentId\":7,", ""), "studentId");
    }

    @Test
    void zeroStudentIdReturns400() throws Exception {
        assertInvalid(VALID_JSON.replace("\"studentId\":7", "\"studentId\":0"), "studentId");
    }

    @Test
    void zeroAmountReturns400() throws Exception {
        assertInvalid(VALID_JSON.replace("300000", "0"), "amount");
    }

    @Test
    void negativeAmountReturns400() throws Exception {
        assertInvalid(VALID_JSON.replace("300000", "-1"), "amount");
    }

    @Test
    void missingAmountReturns400() throws Exception {
        assertInvalid(VALID_JSON.replace("\"amount\":300000,", ""), "amount");
    }

    @Test
    void fractionalAmountReturns400() throws Exception {
        mvc.perform(post("/api/payments").contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_JSON.replace("300000", "300000.5")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void missingDateReturns400() throws Exception {
        assertInvalid(VALID_JSON.replace(",\"paymentDate\":\"2026-10-21\"", ""), "paymentDate");
    }

    @Test
    void invalidDateFormatReturns400() throws Exception {
        mvc.perform(post("/api/payments").contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_JSON.replace("2026-10-21", "21-10-2026")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void invalidCalendarDateReturns400() throws Exception {
        mvc.perform(post("/api/payments").contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_JSON.replace("2026-10-21", "2026-02-30")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void malformedJsonReturns400() throws Exception {
        mvc.perform(post("/api/payments").contentType(MediaType.APPLICATION_JSON).content("{"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void historyReturnsPaymentsInServiceOrder() throws Exception {
        when(service.history(7L)).thenReturn(List.of(
                new PaymentResponse(12L, 7L, 300000L, LocalDate.of(2026, 10, 21)),
                new PaymentResponse(11L, 7L, 200000L, LocalDate.of(2026, 10, 5))));

        mvc.perform(get("/api/students/7/payments"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(12))
                .andExpect(jsonPath("$[0].paymentDate").value("2026-10-21"))
                .andExpect(jsonPath("$[1].id").value(11));
    }

    @Test
    void emptyHistoryReturnsArray() throws Exception {
        when(service.history(7L)).thenReturn(List.of());

        mvc.perform(get("/api/students/7/payments"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    @Test
    void missingStudentHistoryReturns404() throws Exception {
        when(service.history(999L)).thenThrow(new StudentNotFoundException(999L));

        mvc.perform(get("/api/students/999/payments"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.path").value("/api/students/999/payments"));
    }

    @Test
    void invalidHistoryStudentIdReturns400() throws Exception {
        mvc.perform(get("/api/students/0/payments")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/students/-1/payments")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/students/abc/payments")).andExpect(status().isBadRequest());
    }

    private void assertInvalid(String json, String field) throws Exception {
        mvc.perform(post("/api/payments").contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString(field)));
    }
}
