n <- 100; ybar <- 30; sd_value <- 8
se <- sd_value / sqrt(n)
# Study A: known population SD under independent normal sampling.
ci_A <- ybar + c(-1, 1) * qnorm(.975) * se
# Study B: sample SD estimates unknown population SD.
ci_B <- ybar + c(-1, 1) * qt(.975, df = n - 1) * se
print(rbind(A_known_sigma = ci_A, B_sample_sd = ci_B), digits = 10)
stopifnot(ci_B[1] < ci_A[1], ci_B[2] > ci_A[2])
