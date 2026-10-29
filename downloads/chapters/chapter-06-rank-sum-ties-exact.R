# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 06, section: rank-sum-ties-exact
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# The same original tied example used in the rank-statistic lesson.
a <- c(3,5,5)
b <- c(4,8,9)
n_a <- length(a)
n_b <- length(b)
N <- n_a+n_b
observed_ranks <- rank(c(a,b),ties.method="average")
observed_T <- sum(observed_ranks[seq_along(a)])
observed_U <- observed_T-n_a*(n_a+1)/2
# Enumerate observation indices, retaining distinct records with equal values.
pooled <- sort(c(a,b))
ranks <- rank(pooled,ties.method="average")
assignments <- combn(seq_len(N),n_a)
null_T <- apply(assignments,2,function(indices) sum(ranks[indices]))
allocation_table <- data.frame(
  A_indices=apply(assignments,2,paste,collapse=","),
  T_A=null_T,left_extreme=null_T<=observed_T)
print(data.frame(index=seq_len(N),value=pooled,rank=ranks))
print(allocation_table)
print(as.data.frame(table(null_T)))
p_left <- mean(null_T<=observed_T)
p_right <- mean(null_T>=observed_T)
p_two <- min(1,2*min(p_left,p_right))
# The conditional null distribution uses probability 1 / choose(N,n_a).
expected_T <- n_a*(N+1)/2
tie_sizes <- as.numeric(table(pooled))
variance_T <- n_a*n_b/12*(N+1-sum(tie_sizes^3-tie_sizes)/(N*(N-1)))
z_no <- (observed_T-expected_T)/sqrt(variance_T)
# R's left-tail continuity convention adds 0.5 to the observed statistic.
z_cc <- (observed_T-expected_T+.5)/sqrt(variance_T)
p_no <- pnorm(z_no)
p_cc <- pnorm(z_cc)
print(c(T=observed_T,U=observed_U,allocations=ncol(assignments),
        left_extreme=sum(null_T<=observed_T),exact_left=p_left,
        exact_two=p_two,expected_T=expected_T,variance_T=variance_T,
        Z_without_correction=z_no,P_without_correction=p_no,
        Z_with_correction=z_cc,P_with_correction=p_cc))
# Explicitly choose approximations so these calls also work in R 4.4.1.
r_no <- wilcox.test(a,b,alternative="less",exact=FALSE,correct=FALSE)
r_cc <- wilcox.test(a,b,alternative="less",exact=FALSE,correct=TRUE)
print(r_no)
print(r_cc)
print(R.version.string)
stopifnot(ncol(assignments)==20,observed_T==8,observed_U==2,
          abs(p_left-.2)<1e-12,
          abs(mean((null_T-mean(null_T))^2)-variance_T)<1e-12,
          abs(r_no$p.value-p_no)<1e-12,abs(r_cc$p.value-p_cc)<1e-12)
