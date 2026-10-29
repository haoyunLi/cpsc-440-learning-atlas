# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 05, section: student
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Analyze one original sample under an independent normal sampling model.
y <- c(8, 9, 10, 11, 12)
mu0 <- 8.5
alpha <- 0.05
n <- length(y)
ybar <- mean(y)
s <- sd(y)
se <- s / sqrt(n)
df <- n - 1
t_obs <- (ybar - mu0) / se
z_crit <- qnorm(1 - alpha / 2)
t_crit <- qt(1 - alpha / 2, df = df)

# Both rows use the same estimated SE; only the reference distribution changes.
naive_z_p <- 2 * pnorm(-abs(t_obs))
t_p <- 2 * pt(-abs(t_obs), df = df)
naive_z_ci <- ybar + c(-1, 1) * z_crit * se
t_ci <- ybar + c(-1, 1) * t_crit * se
results <- data.frame(
  method = c("Normal reference with sample S", "Student t reference"),
  statistic = rep(t_obs, 2),
  p_value = c(naive_z_p, t_p),
  lower = c(naive_z_ci[1], t_ci[1]),
  upper = c(naive_z_ci[2], t_ci[2])
)
print(c(n = n, mean = ybar, s = s, se = se, df = df), digits = 12)
print(results, digits = 12, row.names = FALSE)

# Check the manual t calculation against the base R implementation.
check <- t.test(y, mu = mu0, alternative = "two.sided",
                conf.level = 1 - alpha)
stopifnot(isTRUE(all.equal(t_p, check$p.value, tolerance = 1e-12)))
stopifnot(isTRUE(all.equal(t_ci, as.numeric(check$conf.int),
                          tolerance = 1e-12)))
stopifnot(naive_z_p < alpha, t_p > alpha)

# Exact repeated-sampling coverage under iid normal observations, not a simulation.
# Here the pivot is centered at the true population mean, not an arbitrary mu0.
naive_coverage <- 2 * pt(z_crit, df = df) - 1
t_coverage <- 2 * pt(t_crit, df = df) - 1
print(c(z_critical = z_crit, t_critical = t_crit,
        naive_coverage = naive_coverage,
        t_coverage = t_coverage,
        naive_null_rejection = 1 - naive_coverage), digits = 12)
stopifnot(abs(naive_coverage - 0.8784403402128) < 1e-12)
stopifnot(abs(t_coverage - (1 - alpha)) < 1e-12)
