# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 07, section: f-tail-output
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

ratio <- 4/9
df_a <- 10-1
df_b <- 15-1
# Keep group order fixed throughout the calculation.
p_left <- pf(ratio,df_a,df_b)
p_right <- pf(ratio,df_a,df_b,lower.tail=FALSE)
p_two <- min(1,2*min(p_left,p_right))
ci <- ratio/qf(c(.975,.025),df_a,df_b)
c(F=ratio,p_two=p_two,lower=ci[1],upper=ci[2])
