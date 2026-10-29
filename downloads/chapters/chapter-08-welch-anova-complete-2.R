# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 08, section: welch-anova-complete
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Define all three two-sided pairwise comparisons before examining results.
groups <- list(A = c(9,10,11,10),
               B = c(5,9,13,17,21,25),
               C = c(10,11,12,13,14))
alpha <- .05
pairs <- combn(names(groups), 2, simplify = FALSE)
m <- length(pairs)
result <- do.call(rbind, lapply(pairs, function(pair) {
  x <- groups[[pair[1]]]; y <- groups[[pair[2]]]
  nx <- length(x); ny <- length(y)
  vx <- var(x) / nx; vy <- var(y) / ny
  difference <- mean(x) - mean(y)
  se <- sqrt(vx + vy)
  df <- (vx + vy)^2 / (vx^2 / (nx - 1) + vy^2 / (ny - 1))
  t_stat <- difference / se
  p_raw <- 2 * pt(-abs(t_stat), df = df)
  critical <- qt(1 - alpha / (2 * m), df = df)
  interval <- difference + c(-1, 1) * critical * se
  # Each interval has nominal confidence 1 - alpha/m, not 1 - alpha.
  check <- t.test(x, y, alternative = "two.sided", var.equal = FALSE,
                  conf.level = 1 - alpha / m)
  stopifnot(abs(unname(check$statistic) - t_stat) < 1e-10,
            abs(unname(check$parameter) - df) < 1e-10,
            abs(check$p.value - p_raw) < 1e-10,
            max(abs(as.numeric(check$conf.int) - interval)) < 1e-10)
  data.frame(pair = paste(pair, collapse = " - "), difference = difference,
             SE = se, df = df, t = t_stat, p_raw = p_raw,
             p_bonferroni = min(1, m * p_raw),
             lower = interval[1], upper = interval[2])
}))
# Bonferroni does not require independence between the three comparisons.
stopifnot(max(abs(result$p_bonferroni -
                  p.adjust(result$p_raw, method = "bonferroni"))) < 1e-10)
print(result, digits = 10, row.names = FALSE)
print(c(family_alpha = alpha, number_of_pairs = m,
        per_pair_confidence = 1 - alpha/m))
# The omnibus question is distinct from the prespecified pairwise questions.
dat <- stack(groups)
print(oneway.test(values ~ ind, data = dat, var.equal = FALSE))
