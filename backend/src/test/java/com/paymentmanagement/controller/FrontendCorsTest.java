package com.paymentmanagement.controller;

import com.paymentmanagement.service.PaymentService;
import com.paymentmanagement.service.StudentService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest({StudentController.class, PaymentController.class})
class FrontendCorsTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private StudentService studentService;

    @MockitoBean
    private PaymentService paymentService;

    @Test
    void allowedLocalOriginsCanReadStudents() throws Exception {
        mvc.perform(get("/api/students").header("Origin", "http://localhost:5500"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5500"));
        mvc.perform(get("/api/students").header("Origin", "http://127.0.0.1:5500"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://127.0.0.1:5500"));
    }

    @Test
    void paymentPreflightAllowsJsonPostFromFrontend() throws Exception {
        mvc.perform(options("/api/payments")
                        .header("Origin", "http://localhost:5500")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "content-type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5500"))
                .andExpect(header().string("Access-Control-Allow-Methods", containsString("POST")))
                .andExpect(header().string("Access-Control-Allow-Headers", containsString("content-type")));
    }

    @Test
    void paymentPostCarriesCorsHeader() throws Exception {
        mvc.perform(post("/api/payments")
                        .header("Origin", "http://localhost:5500")
                        .contentType("application/json")
                        .content("{\"studentId\":1,\"amount\":100,\"paymentDate\":\"2026-10-21\"}"))
                .andExpect(status().isCreated())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5500"));
    }

    @Test
    void unrelatedOriginIsNotAuthorized() throws Exception {
        mvc.perform(options("/api/payments")
                        .header("Origin", "http://localhost:5501")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }
}
