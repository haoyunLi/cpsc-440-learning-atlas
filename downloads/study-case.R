# Original teaching case: 12 pots, three plants per pot.
# These values are constructed, not a simulated random sample.
# Treatment was assigned to pots; plants within a pot are subsamples.
# The prespecified response is the mean height of the three plants per pot.
raw <- read.csv(text = "pot,treatment,plant,height_cm
P01,A,S1,11
P01,A,S2,12
P01,A,S3,13
P02,B,S1,15
P02,B,S2,16
P02,B,S3,17
P03,B,S1,17
P03,B,S2,18
P03,B,S3,19
P04,A,S1,13
P04,A,S2,14
P04,A,S3,15
P05,A,S1,15
P05,A,S2,16
P05,A,S3,17
P06,B,S1,19
P06,B,S2,20
P06,B,S3,21
P07,A,S1,17
P07,A,S2,18
P07,A,S3,19
P08,B,S1,21
P08,B,S2,22
P08,B,S3,23
P09,B,S1,23
P09,B,S2,24
P09,B,S3,25
P10,A,S1,19
P10,A,S2,20
P10,A,S3,21
P11,B,S1,25
P11,B,S2,26
P11,B,S3,27
P12,A,S1,21
P12,A,S2,22
P12,A,S3,23", stringsAsFactors = FALSE)

# Audit identities and completeness before aggregating.
stopifnot(nrow(raw) == 36L, !anyNA(raw),
          all(is.finite(raw$height_cm)),
          !anyDuplicated(raw[c("pot", "plant")]),
          all(table(raw$pot) == 3L),
          all(tapply(raw$treatment, raw$pot,
                     function(x) length(unique(x))) == 1L))
pot <- aggregate(height_cm ~ pot + treatment, data = raw, FUN = mean)
stopifnot(nrow(pot) == 12L, !anyDuplicated(pot$pot),
          all(table(pot$treatment) == 6L))
print(raw)
print(pot)

# Six independent pot responses per group, not eighteen plant responses.
a <- pot$height_cm[pot$treatment == "A"]
b <- pot$height_cm[pot$treatment == "B"]
group_summary <- data.frame(
  treatment = c("A", "B"), n = c(length(a), length(b)),
  mean_cm = c(mean(a), mean(b)), variance_cm2 = c(var(a), var(b)),
  sd_cm = c(sd(a), sd(b))
)
print(group_summary)

# Inspect the pot-level response distributions and residuals.
# With only six pots per group, plots cannot establish Normality.
# Independence and randomization must be checked against the study protocol.
par(mfrow = c(2, 2))
stripchart(height_cm ~ treatment, data = pot, vertical = TRUE,
           method = "stack", pch = 16, ylab = "Pot mean height (cm)")
qqnorm(a, main = "Group A: pot means"); qqline(a)
qqnorm(b, main = "Group B: pot means"); qqline(b)
fitted_means <- ave(pot$height_cm, pot$treatment, FUN = mean)
plot(fitted_means, pot$height_cm - fitted_means,
     xlab = "Fitted group mean (cm)", ylab = "Pot residual (cm)")
abline(h = 0, lty = 2)
par(mfrow = c(1, 1))

# Prespecified two-sided comparison B minus A, alpha = 0.05.
# Welch inference is conditional on a suitable independent pot-level model.
# Similar observed variances do not prove equal population variances.
fit <- t.test(b, a, alternative = "two.sided", var.equal = FALSE,
              conf.level = 0.95)
print(fit)

# Reproduce the same calculation explicitly.
estimate <- mean(b) - mean(a)
vb <- var(b) / length(b)
va <- var(a) / length(a)
se <- sqrt(vb + va)
df <- (vb + va)^2 / (vb^2 / (length(b) - 1) +
                      va^2 / (length(a) - 1))
statistic <- estimate / se
p_value <- 2 * pt(-abs(statistic), df)
ci <- estimate + c(-1, 1) * qt(0.975, df) * se
print(c(estimate = estimate, se = se, df = df, t = statistic,
        p = p_value, lower = ci[1], upper = ci[2]))
stopifnot(abs(se - fit$stderr) < 1e-10,
          abs(p_value - fit$p.value) < 1e-10,
          max(abs(ci - fit$conf.int)) < 1e-8)

# Deliberately INVALID comparison: treating plants as independent replicates.
# This calculation illustrates pseudoreplication; it is not inferential evidence.
wrong <- t.test(raw$height_cm[raw$treatment == "B"],
                raw$height_cm[raw$treatment == "A"])
print(data.frame(
  analysis = c("Pot-level model", "INVALID independent-plant model"),
  n_per_group = c(length(a), sum(raw$treatment == "A")),
  estimate = c(estimate, unname(wrong$estimate[1] - wrong$estimate[2])),
  se = c(fit$stderr, wrong$stderr),
  df = c(unname(fit$parameter), unname(wrong$parameter)),
  p = c(fit$p.value, wrong$p.value),
  lower = c(fit$conf.int[1], wrong$conf.int[1]),
  upper = c(fit$conf.int[2], wrong$conf.int[2])
))

# P > 0.05 is insufficient evidence of a difference, not proof of equivalence.
# Random treatment assignment does not supply random population sampling.
# The interval relies on the pot-level model, not an exact randomization test.
sessionInfo()
