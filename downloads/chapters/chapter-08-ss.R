# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 08, section: ss
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Use the nine original observations from the worked ANOVA example.
y <- c(4, 5, 6, 7, 8, 9, 10, 11, 12)
group <- factor(rep(c("A", "B", "C"), each = 3))
ni <- as.numeric(table(group))
group_means <- as.numeric(tapply(y, group, mean))
group_variances <- as.numeric(tapply(y, group, var))
N <- length(y)
k <- nlevels(group)

# MSE is the degrees-of-freedom-weighted pooled within-group variance.
sse <- sum((ni - 1) * group_variances)
mse <- sse / (N - k)
# This shortcut for MStrt requires equal group sizes.
stopifnot(length(unique(ni)) == 1)
n <- ni[1]
variance_of_means <- var(group_means)
ms_treatment <- n * variance_of_means
ss_treatment <- sum(ni * (group_means - mean(y))^2)
f_value <- ms_treatment / mse
p_value <- pf(f_value, df1 = k - 1, df2 = N - k,
              lower.tail = FALSE)
print(data.frame(group = levels(group), n = ni, mean = group_means,
                 variance = group_variances), row.names = FALSE)
print(c(variance_of_means = variance_of_means,
        MStrt = ms_treatment, SSE = sse, MSE = mse,
        F = f_value, p = p_value), digits = 12)

# Check the manual calculations against the fitted model's ANOVA table.
fit <- lm(y ~ group)
reference <- anova(fit)
print(reference)
stopifnot(abs(ms_treatment - ss_treatment / (k - 1)) < 1e-12,
          abs(mse - reference["Residuals", "Mean Sq"]) < 1e-12,
          abs(ms_treatment - reference["group", "Mean Sq"]) < 1e-12,
          abs(f_value - reference["group", "F value"]) < 1e-12,
          abs(p_value - reference["group", "Pr(>F)"]) < 1e-12,
          abs(f_value - 27) < 1e-12,
          abs(p_value - 0.001) < 1e-12)
