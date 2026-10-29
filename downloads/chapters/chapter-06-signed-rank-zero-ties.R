# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 06, section: signed-rank-zero-ties
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Original paired differences, defined before analysis as after minus before.
d <- c(0,-1,2,2,3,4)
nonzero <- d[d!=0]
m <- length(nonzero)
ranks <- rank(abs(nonzero),ties.method="average")
w_plus <- sum(ranks[nonzero>0])
w_minus <- sum(ranks[nonzero<0])
expected <- m*(m+1)/4
sas_S <- w_plus-expected
tie_sizes <- as.numeric(table(abs(nonzero)))
variance_w <- m*(m+1)*(2*m+1)/24-sum(tie_sizes^3-tie_sizes)/48
print(data.frame(difference=nonzero,absolute=abs(nonzero),rank=ranks))
# Condition on the nonzero magnitudes and enumerate all independent sign assignments.
signs <- as.matrix(expand.grid(rep(list(c(-1,1)),m)))
null_w <- as.vector((signs>0) %*% ranks)
print(data.frame(signs,W_positive=null_w,right_extreme=null_w>=w_plus))
print(as.data.frame(table(null_w)))
p_right <- mean(null_w>=w_plus)
p_left <- mean(null_w<=w_plus)
p_two <- min(1,2*min(p_left,p_right))
z_no <- (w_plus-expected)/sqrt(variance_w)
z_cc <- (w_plus-expected-.5)/sqrt(variance_w)
p_no <- pnorm(z_no,lower.tail=FALSE)
p_cc <- pnorm(z_cc,lower.tail=FALSE)
print(c(original_pairs=length(d),nonzero_pairs=m,W_plus=w_plus,W_minus=w_minus,
        SAS_S=sas_S,expected_W=expected,variance_W=variance_w,
        sign_assignments=nrow(signs),right_extreme=sum(null_w>=w_plus),
        exact_right=p_right,exact_two=p_two,
        Z_without_correction=z_no,P_without_correction=p_no,
        Z_with_correction=z_cc,P_with_correction=p_cc))
# These calls intentionally request approximations, including on R 4.4.1.
r_no <- wilcox.test(d,mu=0,alternative="greater",exact=FALSE,correct=FALSE)
r_cc <- wilcox.test(d,mu=0,alternative="greater",exact=FALSE,correct=TRUE)
print(r_no)
print(r_cc)
print(R.version.string)
stopifnot(m==5,w_plus==14,w_minus==1,sas_S==6.5,
          abs(variance_w-13.625)<1e-12,
          abs(sum(ranks^2)/4-variance_w)<1e-12,
          nrow(signs)==32,abs(p_right-.0625)<1e-12,
          abs(r_no$p.value-p_no)<1e-12,abs(r_cc$p.value-p_cc)<1e-12)
