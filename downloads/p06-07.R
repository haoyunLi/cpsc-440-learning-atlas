a <- c(2,2,6)
b <- c(3,7,8)
n_a <- length(a)
pooled_ranks <- rank(c(a,b),ties.method="average")
observed <- sum(pooled_ranks[seq_along(a)])
# Enumerate record indices; equal-valued records remain distinct.
assignments <- combn(seq_along(pooled_ranks),n_a)
null_T <- apply(assignments,2,function(i) sum(pooled_ranks[i]))
answer <- mean(null_T<=observed)
print(c(observed_T=observed,U=observed-n_a*(n_a+1)/2,
        assignments=ncol(assignments),left_extreme=sum(null_T<=observed),
        answer=answer))
print(as.data.frame(table(null_T)))
# Diagnostic alternatives use the same observed data but a different reference.
no_cc <- wilcox.test(a,b,alternative="less",exact=FALSE,correct=FALSE)$p.value
with_cc <- wilcox.test(a,b,alternative="less",exact=FALSE,correct=TRUE)$p.value
print(c(normal_no_cc=no_cc,normal_with_cc=with_cc,
        wrong_unique_statistics=mean(unique(null_T)<=observed),
        two_sided=2*answer))
stopifnot(observed==7,ncol(assignments)==20,sum(null_T<=observed)==2,
          abs(answer-.1)<1e-12)
