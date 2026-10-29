# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 04, section: binomial
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Expected value is a probability-weighted population quantity.
service_time <- c(10, 60)
service_probability <- c(.8, .2)
expected_time <- sum(service_time * service_probability)
print(c(expected_time = expected_time, expected_total_100 = 100 * expected_time))
stopifnot(sum(service_probability) == 1, abs(expected_time - 20) < 1e-12)

# Enumerate all eight outcomes of three independent, unequal-probability trials.
p <- c(.2, .4, .7)
outcomes <- expand.grid(I1 = 0:1, I2 = 0:1, I3 = 0:1)
outcomes <- outcomes[order(outcomes$I1, outcomes$I2, outcomes$I3), ]
rownames(outcomes) <- NULL
probability <- apply(outcomes, 1, function(z) prod(p^z * (1 - p)^(1 - z)))
count <- rowSums(outcomes)
result <- data.frame(outcomes, X = count, probability = probability,
                     contribution = count * probability)
print(result, digits = 10, row.names = FALSE)
count_probability <- vapply(0:3, function(k) sum(probability[count == k]), numeric(1))
expected_count <- sum(count * probability)
variance_count <- sum((count - expected_count)^2 * probability)
# Linearity uses marginal probabilities; it does not require independence.
indicator_expectations <- colSums(as.matrix(outcomes) * probability)
# The binomial with the same mean has a different probability distribution.
p_common <- expected_count / 3
comparison <- data.frame(X = 0:3, actual = count_probability,
                         binomial_same_mean = dbinom(0:3, 3, p_common))
print(comparison, digits = 10, row.names = FALSE)
print(c(expected_count = expected_count, variance_count = variance_count,
        independent_variance_sum = sum(p * (1 - p)),
        common_p = p_common, binomial_variance = 3 * p_common * (1 - p_common)))
stopifnot(abs(sum(probability) - 1) < 1e-12,
          max(abs(probability - c(.144, .336, .096, .224, .036, .084, .024, .056))) < 1e-12,
          max(abs(count_probability - c(.144, .468, .332, .056))) < 1e-12,
          max(abs(indicator_expectations - p)) < 1e-12,
          abs(expected_count - 1.3) < 1e-12,
          abs(expected_count - sum(indicator_expectations)) < 1e-12,
          abs(variance_count - .61) < 1e-12,
          abs(variance_count - sum(p * (1 - p))) < 1e-12,
          abs(comparison$actual[1] - comparison$binomial_same_mean[1]) > .03)

# Copying one indicator twice preserves the sum of expectations, not independence.
p_copy <- .3
copied_count <- c(0, 2)
copied_probability <- c(1 - p_copy, p_copy)
copied_mean <- sum(copied_count * copied_probability)
copied_variance <- sum((copied_count - copied_mean)^2 * copied_probability)
independent_count <- 0:2
independent_probability <- dbinom(independent_count, 2, p_copy)
independent_mean <- sum(independent_count * independent_probability)
independent_variance <- sum((independent_count - independent_mean)^2 * independent_probability)
print(data.frame(design = c("One indicator copied twice", "Two independent indicators"),
                 mean = c(copied_mean, independent_mean),
                 variance = c(copied_variance, independent_variance)))
stopifnot(abs(copied_mean - 2 * p_copy) < 1e-12,
          abs(independent_mean - copied_mean) < 1e-12,
          abs(copied_variance - 4 * p_copy * (1 - p_copy)) < 1e-12,
          abs(copied_variance - .84) < 1e-12,
          abs(independent_variance - 2 * p_copy * (1 - p_copy)) < 1e-12,
          abs(independent_variance - .42) < 1e-12)
