# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 09, section: procedures
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

group_means <- c(control=10,A=12,B=14,C=16)
ni <- rep(4,4)
mse <- 4
alpha <- .05
g <- length(group_means)
error_df <- sum(ni)-g
# Define the three planned questions before inspecting their results.
C <- rbind(control_vs_active=c(1,-1/3,-1/3,-1/3),
           A_vs_BC=c(0,1,-.5,-.5),B_vs_C=c(0,0,1,-1))
stopifnot(all(abs(rowSums(C))<1e-12))
estimate <- as.vector(C %*% group_means)
se <- sqrt(mse*rowSums(sweep(C^2,2,ni,"/")))
t_obs <- estimate/se
m <- nrow(C)
p_raw <- 2*pt(-abs(t_obs),error_df)
multiplier_b <- qt(1-alpha/(2*m),error_df)
multiplier_s <- sqrt((g-1)*qf(1-alpha,g-1,error_df))
p_s <- pf(t_obs^2/(g-1),g-1,error_df,lower.tail=FALSE)
results <- data.frame(contrast=rownames(C),estimate=estimate,SE=se,
                      ordinary_p=p_raw,bonferroni_p=pmin(1,m*p_raw),
                      scheffe_p=p_s,
                      scheffe_lower=estimate-multiplier_s*se,
                      scheffe_upper=estimate+multiplier_s*se)
print(results)
print(c(ordinary=qt(1-alpha/2,error_df),
        bonferroni=multiplier_b,scheffe=multiplier_s))
print(c(bonferroni_lower=estimate[1]-multiplier_b*se[1],
        bonferroni_upper=estimate[1]+multiplier_b*se[1]))
stopifnot(abs(p_s[1]-.0345903571556)<1e-12,
          abs(results$scheffe_lower[1]+7.7364661483801)<1e-10)
