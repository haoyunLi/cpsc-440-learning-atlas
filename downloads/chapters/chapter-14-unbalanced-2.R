# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 14, section: unbalanced
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Original 2-by-2 example: cell A2B2 has no observations.
# The observed errors are assumed independent Normal with a common variance.
d <- data.frame(
  A = factor(rep(c("A1", "A1", "A2"), each = 2), levels = c("A1", "A2")),
  B = factor(rep(c("B1", "B2", "B1"), each = 2), levels = c("B1", "B2")),
  y = c(4, 6, 8, 10, 7, 9)
)
contrast_coding <- list(A = contr.treatment(2), B = contr.treatment(2))
print(with(d, table(A, B)))
print(aggregate(y ~ A + B, data = d, FUN = mean))
full <- lm(y ~ A * B, data = d, contrasts = contrast_coding)
X <- model.matrix(full)
print(X)
print(coef(full))
print(c(columns = ncol(X), rank = qr(X)$rank,
        residual_df = df.residual(full), SSE = deviance(full)))
stopifnot(ncol(X) == 4, qr(X)$rank == 3, full$rank == 3,
          sum(is.na(coef(full))) == 1, all(X[, 4] == 0))

# Two complete parameter vectors fit every observed row equally well.
# The last coefficient is deliberately varied, not estimated from the data.
beta_candidates <- cbind(
  candidate_1 = c(5, 3, 4, 0),
  candidate_2 = c(5, 3, 4, 8)
)
rownames(beta_candidates) <- colnames(X)
observed_fits <- X %*% beta_candidates
print(beta_candidates)
print(cbind(y = d$y, observed_fits))
stopifnot(max(abs(observed_fits[, 1] - observed_fits[, 2])) < 1e-12,
          max(abs(observed_fits[, 1] - fitted(full))) < 1e-12)

# Evaluate these hypothetical parameter vectors on all four cells manually.
# Do not use a rank-deficient predict call or replace an unidentified NA by zero.
grid <- data.frame(
  A = factor(c("A1", "A1", "A2", "A2"), levels = levels(d$A)),
  B = factor(c("B1", "B2", "B1", "B2"), levels = levels(d$B))
)
X_grid <- model.matrix(~ A * B, data = grid, contrasts.arg = contrast_coding)
cell_means <- X_grid %*% beta_candidates
print(cbind(grid, as.data.frame(cell_means)))
# Equal weights over B define the marginal A2-minus-A1 comparison.
marginal_coefficients <- c(-.5, -.5, .5, .5)
marginal_candidates <- drop(marginal_coefficients %*% cell_means)
print(marginal_candidates)
stopifnot(max(abs(cell_means[4, ] - c(12, 20))) < 1e-12,
          max(abs(marginal_candidates - c(3, 7))) < 1e-12)

# One prespecified, estimable simple comparison uses two observed cells at B1.
y_A1B1 <- with(d, y[A == "A1" & B == "B1"])
y_A2B1 <- with(d, y[A == "A2" & B == "B1"])
estimate <- mean(y_A2B1) - mean(y_A1B1)
error_df <- df.residual(full)
mse <- deviance(full) / error_df
se <- sqrt(mse * (1 / length(y_A1B1) + 1 / length(y_A2B1)))
t_value <- estimate / se
p_value <- 2 * pt(-abs(t_value), df = error_df)
ci <- estimate + c(-1, 1) * qt(.975, df = error_df) * se
print(c(estimate = estimate, MSE = mse, SE = se, df = error_df,
        t = t_value, p = p_value, lower = ci[1], upper = ci[2]), digits = 12)
# In this reference coding, the second coefficient is the B1 simple effect.
coefficient_table <- summary(full)$coefficients
stopifnot(abs(estimate - coefficient_table[2, "Estimate"]) < 1e-12,
          abs(se - coefficient_table[2, "Std. Error"]) < 1e-12,
          abs(p_value - coefficient_table[2, "Pr(>|t|)"]) < 1e-12,
          error_df == 3, abs(mse - 2) < 1e-12,
          abs(p_value - .124027062657554) < 1e-12)

# Additivity supplies an extra model restriction: the interaction is zero.
# The additive model has full column rank, so its new-cell prediction is defined.
additive <- lm(y ~ A + B, data = d, contrasts = contrast_coding)
additive_cell_means <- predict(additive, newdata = grid)
print(cbind(grid, additive_prediction = additive_cell_means))
comparison <- data.frame(
  model = c("Observed full-factorial fit", "Additive fit"),
  rank = c(full$rank, additive$rank),
  error_df = c(df.residual(full), df.residual(additive)),
  SSE = c(deviance(full), deviance(additive))
)
print(comparison)
stopifnot(qr(model.matrix(additive))$rank == ncol(model.matrix(additive)),
          max(abs(fitted(full) - fitted(additive))) < 1e-12,
          abs(additive_cell_means[4] - 12) < 1e-12,
          full$rank == additive$rank,
          df.residual(full) == df.residual(additive),
          abs(deviance(full) - deviance(additive)) < 1e-12)
# No extra fitted dimension remains for a full-versus-additive interaction F test.
# Identical observed fits do not validate additivity or recover the missing cell.
